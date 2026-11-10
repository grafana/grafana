package source

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	sourcev1 "github.com/grafana/grafana/apps/provisioning/pkg/source/v1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const hintSecret = "hint-secret"

func hintRepo(secret string) *sourceRepository {
	return &sourceRepository{
		config:        &provisioning.Repository{Spec: provisioning.RepositorySpec{Type: provisioning.SourceRepositoryType}},
		desc:          &sourcev1.Descriptor{Id: "stacks-1"},
		webhookSecret: common.RawSecureValue(secret),
	}
}

func signedHint(t *testing.T, at time.Time, body string) *http.Request {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/webhook", bytes.NewBufferString(body))
	req.Header.Set(sourcev1.HeaderHintTimestamp, strconv.FormatInt(at.Unix(), 10))
	req.Header.Set(sourcev1.HeaderHintSignature, sourcev1.SignHint(hintSecret, at, []byte(body)))
	req.Header.Set(sourcev1.HeaderHintDelivery, "delivery-1")
	return req
}

func TestVerifyRequest(t *testing.T) {
	fixed := time.Unix(1761911000, 0)
	now = func() time.Time { return fixed }
	t.Cleanup(func() { now = time.Now })

	const body = `{"type":"revision","revision":"b81d03c2ee"}`

	t.Run("a signed hint is accepted and keyed by its signature", func(t *testing.T) {
		req := signedHint(t, fixed, body)
		verified, err := hintRepo(hintSecret).VerifyRequest(req)
		require.NoError(t, err)
		assert.JSONEq(t, body, string(verified.Payload))
		assert.Equal(t, req.Header.Get(sourcev1.HeaderHintSignature), verified.ReplayKey,
			"the delivery id is not covered by the HMAC, so it cannot be the replay key")
	})

	t.Run("the timestamp window is five minutes either way", func(t *testing.T) {
		for _, skew := range []time.Duration{-4 * time.Minute, 4 * time.Minute} {
			_, err := hintRepo(hintSecret).VerifyRequest(signedHint(t, fixed.Add(skew), body))
			assert.NoError(t, err, skew)
		}
		for _, skew := range []time.Duration{-6 * time.Minute, 6 * time.Minute} {
			_, err := hintRepo(hintSecret).VerifyRequest(signedHint(t, fixed.Add(skew), body))
			assert.True(t, apierrors.IsUnauthorized(err), "skew %s: %v", skew, err)
		}
	})

	t.Run("refused hints", func(t *testing.T) {
		tests := []struct {
			name   string
			repo   *sourceRepository
			mutate func(*http.Request)
		}{
			{"wrong secret", hintRepo("another"), func(*http.Request) {}},
			{"missing signature", hintRepo(hintSecret), func(r *http.Request) { r.Header.Del(sourcev1.HeaderHintSignature) }},
			{"missing timestamp", hintRepo(hintSecret), func(r *http.Request) { r.Header.Del(sourcev1.HeaderHintTimestamp) }},
			{"timestamp that is not a number", hintRepo(hintSecret), func(r *http.Request) { r.Header.Set(sourcev1.HeaderHintTimestamp, "yesterday") }},
			{"tampered timestamp", hintRepo(hintSecret), func(r *http.Request) {
				r.Header.Set(sourcev1.HeaderHintTimestamp, strconv.FormatInt(fixed.Add(time.Second).Unix(), 10))
			}},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				req := signedHint(t, fixed, body)
				tt.mutate(req)
				_, err := tt.repo.VerifyRequest(req)
				assert.True(t, apierrors.IsUnauthorized(err), "%v", err)
			})
		}
	})

	t.Run("hints are off without a secret", func(t *testing.T) {
		_, err := hintRepo("").VerifyRequest(signedHint(t, fixed, body))
		assert.True(t, apierrors.IsBadRequest(err), "%v", err)
	})
}

func TestProcessRequest(t *testing.T) {
	process := func(payload string) (repository.WebhookEvent, error) {
		return hintRepo(hintSecret).ProcessRequest(context.Background(), &repository.VerifiedWebhookRequest{Payload: []byte(payload)})
	}

	t.Run("a revision hint is a push", func(t *testing.T) {
		event, err := process(`{"type":"revision","revision":"b81d03c2ee"}`)
		require.NoError(t, err)
		assert.Equal(t, repository.WebhookEventPush, event.Type)
		assert.Equal(t, "stacks-1", event.RepoSlug)
		assert.Equal(t, "b81d03c2ee", event.Hash)
	})

	t.Run("a hint for another source keeps its id so the dispatcher refuses it", func(t *testing.T) {
		event, err := process(`{"type":"revision","revision":"b81d03c2ee","id":"stacks-2"}`)
		require.NoError(t, err)
		assert.Equal(t, "stacks-2", event.RepoSlug)
		assert.NotEqual(t, hintRepo(hintSecret).Slug(), event.RepoSlug)
	})

	t.Run("ping", func(t *testing.T) {
		event, err := process(`{"type":"ping"}`)
		require.NoError(t, err)
		assert.Equal(t, repository.WebhookEventPing, event.Type)
	})

	t.Run("unknown types are unsupported", func(t *testing.T) {
		event, err := process(`{"type":"explode"}`)
		require.NoError(t, err)
		assert.Equal(t, repository.WebhookEventUnsupported, event.Type)
	})

	t.Run("bad payloads", func(t *testing.T) {
		_, err := process(`not json`)
		assert.True(t, apierrors.IsBadRequest(err))
		_, err = process(`{"type":"revision","revision":"../etc"}`)
		assert.ErrorIs(t, err, repository.ErrInvalidRef)
	})
}

func TestReceivesWebhooksWithoutRegistration(t *testing.T) {
	repo := hintRepo(hintSecret)
	assert.Empty(t, repo.WebhookURL(), "the controller must not try to register a hook")
	assert.Nil(t, repo.WebhookClient())

	var _ repository.UnregisteredWebhookRepository = repo
}
