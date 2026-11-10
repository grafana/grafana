package source

import (
	"cmp"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	sourcev1 "github.com/grafana/grafana/apps/provisioning/pkg/source/v1"
)

var (
	_ repository.UnregisteredWebhookRepository = (*sourceRepository)(nil)
	_ repository.WebhookRepository             = (*versionedSourceRepository)(nil)

	// now is replaced in tests.
	now = time.Now
)

// Slug is the source id; a hint that names another source is refused.
func (r *sourceRepository) Slug() string {
	return r.desc.GetId()
}

// ReceivesUnregisteredWebhooks marks that the source pushes to Grafana: nothing is
// registered with it, so there is no webhook status or public URL to require.
func (r *sourceRepository) ReceivesUnregisteredWebhooks() {}

// WebhookURL is empty because the controller registers nothing; the source is told the URL
// and the secret when it is set up.
func (r *sourceRepository) WebhookURL() string { return "" }

func (r *sourceRepository) WebhookClient() repository.WebhookClient { return nil }

func (r *sourceRepository) SubscribedEvents() []string { return nil }

// VerifyRequest authenticates a hint with the shared secret and refuses stale timestamps.
// The replay key is the signature, not X-Source-Delivery: only the signature is covered by the HMAC.
func (r *sourceRepository) VerifyRequest(req *http.Request) (*repository.VerifiedWebhookRequest, error) {
	if r.webhookSecret.IsZero() {
		return nil, apierrors.NewBadRequest("hints are not enabled: secure.webhookSecret is not set")
	}

	body, err := io.ReadAll(req.Body)
	if err != nil {
		return nil, apierrors.NewBadRequest("unreadable request body")
	}

	timestamp := req.Header.Get(sourcev1.HeaderHintTimestamp)
	sent, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return nil, apierrors.NewUnauthorized("invalid timestamp")
	}
	if skew := now().Sub(time.Unix(sent, 0)); skew > sourcev1.HintTolerance || skew < -sourcev1.HintTolerance {
		return nil, apierrors.NewUnauthorized("timestamp outside the accepted window")
	}

	signature := req.Header.Get(sourcev1.HeaderHintSignature)
	if !sourcev1.VerifyHintSignature(string(r.webhookSecret), timestamp, body, signature) {
		return nil, apierrors.NewUnauthorized("invalid signature")
	}
	return &repository.VerifiedWebhookRequest{Payload: body, Header: req.Header, ReplayKey: signature}, nil
}

// ProcessRequest turns a hint into a push event, which the dispatcher answers with a pull job.
func (r *sourceRepository) ProcessRequest(_ context.Context, req *repository.VerifiedWebhookRequest) (repository.WebhookEvent, error) {
	var hint sourcev1.Hint
	if err := json.Unmarshal(req.Payload, &hint); err != nil {
		return repository.WebhookEvent{}, apierrors.NewBadRequest("invalid payload")
	}

	switch hint.Type {
	case sourcev1.HintRevision:
		if !revisionPattern.MatchString(hint.Revision) {
			return repository.WebhookEvent{}, repository.ErrInvalidRef
		}
		return repository.WebhookEvent{
			Type:     repository.WebhookEventPush,
			RepoSlug: cmp.Or(hint.ID, r.Slug()),
			Hash:     hint.Revision,
		}, nil
	case sourcev1.HintPing:
		return repository.WebhookEvent{Type: repository.WebhookEventPing}, nil
	default:
		return repository.WebhookEvent{Type: repository.WebhookEventUnsupported, Message: "unsupported hint type " + hint.Type}, nil
	}
}
