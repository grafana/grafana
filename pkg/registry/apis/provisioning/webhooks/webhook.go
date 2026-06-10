package webhooks

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"golang.org/x/time/rate"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	provisioningapis "github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
	"github.com/prometheus/client_golang/prometheus"
)

type WebhookRepository interface {
	Webhook(ctx context.Context, req *http.Request) (*provisioning.WebhookResponse, error)
}

// Webhook endpoint max size (25MB)
// See https://docs.github.com/en/webhooks/webhook-events-and-payloads
const webhookMaxBodySize = 25 * 1024 * 1024

// This only works for github right now
type webhookConnector struct {
	webhooksEnabled bool
	core            *provisioningapis.APIBuilder
	renderer        pullrequest.ScreenshotRenderer
	registry        prometheus.Registerer
	metrics         webhookMetrics
	timeout         time.Duration
	rateLimiter     *ipRateLimiter
}

func NewWebhookConnector(
	webhooksEnabled bool,
	// TODO: use interface for this
	core *provisioningapis.APIBuilder,
	renderer pullrequest.ScreenshotRenderer,
	registry prometheus.Registerer,
	trustedProxyDepth int,
	rateLimitRPS int,
) *webhookConnector {
	metrics := registerWebhookMetrics(registry)

	// A non-positive rps disables rate limiting: the limiter is left nil and
	// Connect skips wrapping. This is the default so an upgrade never starts
	// throttling traffic until a deployment explicitly configures a rate (and,
	// where it sits behind a proxy, the trusted-proxy depth to key on).
	var rateLimiter *ipRateLimiter
	if rateLimitRPS > 0 {
		rateLimiter = newIPRateLimiter(rate.Limit(rateLimitRPS), rateLimitRPS*2, trustedProxyDepth)
	}

	return &webhookConnector{
		webhooksEnabled: webhooksEnabled,
		core:            core,
		renderer:        renderer,
		registry:        registry,
		metrics:         metrics,
		rateLimiter:     rateLimiter,
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
	namespace := request.NamespaceValue(ctx)

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, span := tracing.Start(r.Context(), "provisioning.webhook.handle")
		defer span.End()

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

		hooks, ok := repo.(WebhookRepository)
		if !ok {
			responder.Error(errors.NewBadRequest("the repository does not support webhooks"))
			return
		}

		if hmacHeader := r.Header.Get("X-Hub-Signature-256"); hmacHeader == "" {
			span.RecordError(err)
			responder.Error(errors.NewBadRequest("X-Hub-Signature-256 header is missing"))
			return
		}

		// Limit the webhook request body size
		r.Body = http.MaxBytesReader(w, r.Body, webhookMaxBodySize)

		rsp, err := hooks.Webhook(ctx, r)
		if err != nil {
			span.RecordError(err)
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
	})

	var h http.Handler = handler
	if s.rateLimiter != nil {
		h = s.rateLimiter.wrap(namespace, h)
	}

	return h, nil
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
