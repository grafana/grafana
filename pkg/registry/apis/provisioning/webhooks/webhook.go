package webhooks

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	provisioningapis "github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
	"github.com/prometheus/client_golang/prometheus"
)

// Webhook endpoint max size (25MB)
// See https://docs.github.com/en/webhooks/webhook-events-and-payloads
const webhookMaxBodySize = 25 * 1024 * 1024

// webhookCore is the subset of the provisioning APIBuilder the webhook
// connector depends on, so lower-level code doesn't import the builder package.
type webhookCore interface {
	GetGroupVersion() schema.GroupVersion
	GetHealthyRepository(ctx context.Context, name string) (repository.Repository, error)
	GetJobQueue() jobs.Queue
	GetStatusPatcher() *appcontroller.RepositoryStatusPatcher
	GetIncrementalPolicy() repository.IncrementalSyncPolicy
}

// This only works for github right now
type webhookConnector struct {
	webhooksEnabled bool
	core            webhookCore
	renderer        pullrequest.ScreenshotRenderer
	registry        prometheus.Registerer
	metrics         webhookMetrics
	// replayCache is the process-wide webhook replay cache, shared across every
	// provider repository the connector dispatches for.
	replayCache *replayCache
}

func NewWebhookConnector(
	webhooksEnabled bool,
	core webhookCore,
	renderer pullrequest.ScreenshotRenderer,
	registry prometheus.Registerer,
) *webhookConnector {
	metrics := registerWebhookMetrics(registry)
	return &webhookConnector{
		webhooksEnabled: webhooksEnabled,
		core:            core,
		renderer:        renderer,
		registry:        registry,
		metrics:         metrics,
		replayCache:     newReplayCache(defaultReplayCacheTTL),
	}
}

func (*webhookConnector) New() runtime.Object {
	return &provisioning.WebhookResponse{}
}

func (*webhookConnector) Destroy() {}

func (*webhookConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*webhookConnector) ProducesObject(verb string) any {
	return &provisioning.WebhookResponse{}
}

func (*webhookConnector) ConnectMethods() []string {
	return []string{http.MethodPost}
}

func (*webhookConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (s *webhookConnector) Authorize(ctx context.Context, a authorizer.Attributes) (decision authorizer.Decision, reason string, err error) {
	if provisioning.RepositoryResourceInfo.GetName() == a.GetResource() && a.GetSubresource() == "webhook" {
		// When the resource is a webhook, we'll deal with permissions manually by checking signatures or similar in the webhook handler.
		// The user in this context is usually an anonymous user, but may also be an authenticated synthetic check by the Grafana instance's operator as well.
		// For context on the anonymous user, check the authn/clients/provisioning.go file.
		return authorizer.DecisionAllow, "", nil
	}

	return authorizer.DecisionNoOpinion, "", nil
}

func (s *webhookConnector) UpdateStorage(storage map[string]rest.Storage) error {
	storage[provisioning.RepositoryResourceInfo.StoragePath("webhook")] = provisioningapis.WithTimeout(s, 30*time.Second)
	return nil
}

func (s *webhookConnector) PostProcessOpenAPI(oas *spec3.OpenAPI) error {
	root := "/apis/" + s.core.GetGroupVersion().String() + "/"
	repoprefix := root + "namespaces/{namespace}/repositories/{name}"
	sub := oas.Paths.Paths[repoprefix+"/webhook"]
	if sub != nil {
		sub.Get = nil
		if sub.Post != nil {
			sub.Post.Description = "Currently only supports github webhooks"
		}
	}

	return nil
}

func (s *webhookConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, span := tracing.Start(ctx, "provisioning.webhook.handle")
		defer span.End()

		namespace := request.NamespaceValue(ctx)
		span.SetAttributes(
			attribute.String("repository", name),
			attribute.String("namespace", namespace),
		)

		logger := logging.FromContext(ctx).With("logger", "webhook-connector", "repo", name)
		ctx = logging.Context(ctx, logger)

		// Switch to the worker identity (the request user is likely anonymous), then
		// fetch the repository under that identity. Both calls run against the
		// timeout-bounded ctx so they can't hang past the connector's SLA.
		var err error
		ctx, _, err = identity.WithProvisioningIdentity(ctx, namespace)
		if err != nil {
			span.RecordError(err)
			responder.Error(err)
			return
		}

		// Get the repository with the worker identity. Reject the request early if
		// the repository is not healthy.
		repo, err := s.core.GetHealthyRepository(ctx, name)
		if err != nil {
			span.RecordError(err)
			responder.Error(err)
			return
		}

		if !s.webhooksEnabled {
			responder.Error(errors.NewBadRequest("webhooks are not enabled"))
			return
		}

		hooks, ok := repo.(repository.WebhookRepository)
		if !ok {
			cfg := repo.Config()
			if cfg.Spec.Webhook != nil && cfg.Spec.Webhook.Disabled {
				responder.Error(errors.NewBadRequest("webhook integration is disabled for this repository"))
				return
			}
			responder.Error(errors.NewBadRequest("the repository does not support webhooks"))
			return
		}

		// Limit the webhook request body size
		r.Body = http.MaxBytesReader(w, r.Body, webhookMaxBodySize)

		rsp, err := s.webhook(ctx, r, hooks)
		if err != nil {
			span.RecordError(err)
			logger.Error("failed to process webhook request", "error", err)
			responder.Error(err)
			return
		}

		if rsp == nil {
			err := fmt.Errorf("expecting a response")
			span.RecordError(err)
			responder.Error(err)
			return
		}

		if err := s.updateLastEvent(ctx, repo); err != nil {
			// Continue processing as this is non-critical; the update is purely informational
			logger.Error("failed to update last event", "error", err)
		}

		actionTaken := "none"
		defer func() {
			s.metrics.recordEventProcessed(actionTaken)
		}()

		if rsp.Job != nil {
			rsp.Job.Repository = name
			actionTaken = string(rsp.Job.Action)
			span.SetAttributes(attribute.String("job.action", actionTaken))

			job, err := s.core.GetJobQueue().Insert(ctx, namespace, *rsp.Job)
			if err != nil {
				span.RecordError(err)
				logger.Error("failed to insert job", "error", err)
				responder.Error(err)
				return
			}
			span.SetAttributes(attribute.String("job.name", job.Name))
			logger.Info("webhook job created", "job", job.Name, "action", actionTaken)
			responder.Object(rsp.Code, job)
			return
		}

		responder.Object(rsp.Code, rsp)
	}), nil
}

// webhook turns an inbound delivery into a sync/pull-request job response. The
// repository supplies the normalized event via ProcessRequest; this dispatches
// it against the configured repository and branch.
func (s *webhookConnector) webhook(ctx context.Context, req *http.Request, repo repository.WebhookRepository) (*provisioning.WebhookResponse, error) {
	if repo.Config().Status.Webhook == nil {
		return nil, fmt.Errorf("unexpected webhook request")
	}

	ctx = logging.Context(ctx, logging.FromContext(ctx).With("slug", repo.Slug(), "ref", repo.Config().Branch()))

	// Authenticate the request before parsing anything.
	verified, err := repo.VerifyRequest(req)
	if err != nil {
		return nil, err
	}

	// Silently drop a delivery whose replay key we have already processed within
	// the cache TTL — returning a generic 200 avoids confirming to a replay
	// attacker that the captured payload was a real previously-processed delivery.
	if s.replayCache.seenOrAdd(verified.ReplayKey) {
		logging.FromContext(ctx).Debug("dropping replayed webhook delivery")
		return &provisioning.WebhookResponse{Code: http.StatusOK, Message: "ok"}, nil
	}

	event, err := repo.ProcessRequest(ctx, verified)
	if err != nil {
		return nil, err
	}

	ctx = event.ToCtxLogger(ctx)
	logging.FromContext(ctx).Debug("webhook event received")

	switch event.Type {
	case repository.WebhookEventPush:
		if event.RepoSlug != repo.Slug() {
			logging.FromContext(ctx).Warn("webhook push event repository mismatch", "expected", repo.Slug(), "got", event.RepoSlug)
			return nil, repository.ErrRepositoryMismatch
		}
		if !repo.Config().Spec.Sync.Enabled {
			return &provisioning.WebhookResponse{Code: http.StatusOK}, nil
		}
		// Skip silently if the event is not for the configured branch, as the
		// webhook cannot be configured to only publish events for one branch.
		if event.Branch != repo.Config().Branch() {
			return &provisioning.WebhookResponse{Code: http.StatusOK}, nil
		}
		return s.pushSyncResponse(event), nil
	case repository.WebhookEventPullRequest:
		if event.RepoSlug != repo.Slug() {
			logging.FromContext(ctx).Warn("webhook pull request event repository mismatch", "expected", repo.Slug(), "got", event.RepoSlug)
			return nil, repository.ErrRepositoryMismatch
		}
		if event.Branch != repo.Config().Branch() {
			return &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: fmt.Sprintf("ignoring pull request event as %s is not the configured branch", event.Branch),
			}, nil
		}
		if !watchedPullRequestAction(event.Action) {
			return &provisioning.WebhookResponse{
				Code:    http.StatusOK,
				Message: fmt.Sprintf("ignore pull request event: %s", event.Action),
			}, nil
		}
		return pullRequestResponse(event), nil
	case repository.WebhookEventPing:
		return &provisioning.WebhookResponse{Code: http.StatusOK, Message: "ping received"}, nil
	default:
		return &provisioning.WebhookResponse{Code: http.StatusNotImplemented, Message: event.Message}, nil
	}
}

func (s *webhookConnector) pushSyncResponse(event repository.WebhookEvent) *provisioning.WebhookResponse {
	return &provisioning.WebhookResponse{
		Code: http.StatusAccepted,
		Job: &provisioning.JobSpec{
			Action: provisioning.JobActionPull,
			Pull: &provisioning.SyncJobOptions{
				Incremental: s.core.GetIncrementalPolicy().CanUseIncrementalSync(event.DeletedPaths, event.TotalChanges),
			},
		},
	}
}

func pullRequestResponse(event repository.WebhookEvent) *provisioning.WebhookResponse {
	return &provisioning.WebhookResponse{
		Code:    http.StatusAccepted,
		Message: fmt.Sprintf("pull request: %s", event.Action),
		Job: &provisioning.JobSpec{
			Action: provisioning.JobActionPullRequest,
			PullRequest: &provisioning.PullRequestJobOptions{
				URL:  event.PRURL,
				PR:   event.PRNumber,
				Ref:  event.SourceRef,
				Hash: event.Hash,
			},
		},
	}
}

func watchedPullRequestAction(action repository.PullRequestAction) bool {
	switch action {
	case repository.PullRequestActionOpened, repository.PullRequestActionReopened, repository.PullRequestActionUpdated:
		return true
	default:
		return false
	}
}

// statusPatcher is the subset of the status patcher API used by updateLastEvent.
type statusPatcher interface {
	Patch(ctx context.Context, repo *provisioning.Repository, patchOperations ...map[string]interface{}) error
}

// updateLastEvent updates the last event time for the webhook
// This is to provide some visibility that the webhook is still active and working
// It's not a good idea to update the webhook status too often, so we only update it if it's been a while
func (s *webhookConnector) updateLastEvent(ctx context.Context, repo repository.Repository) error {
	patcher := s.core.GetStatusPatcher()
	if patcher == nil {
		// This would only happen if we wired things up incorrectly
		return fmt.Errorf("status patcher is nil")
	}

	return updateLastEvent(ctx, repo.Config(), patcher)
}

func updateLastEvent(ctx context.Context, cfg *provisioning.Repository, patcher statusPatcher) error {
	if cfg.Status.Webhook == nil {
		return nil
	}

	lastEvent := time.UnixMilli(cfg.Status.Webhook.LastEvent)
	if time.Since(lastEvent) <= time.Minute {
		return nil
	}

	patchOp := map[string]any{
		"op":    "replace",
		"path":  "/status/webhook/lastEvent",
		"value": time.Now().UnixMilli(),
	}

	if err := patcher.Patch(ctx, cfg, patchOp); err != nil {
		return fmt.Errorf("patch status: %w", err)
	}

	return nil
}

var (
	_ rest.Storage         = (*webhookConnector)(nil)
	_ rest.Connecter       = (*webhookConnector)(nil)
	_ rest.StorageMetadata = (*webhookConnector)(nil)
)
