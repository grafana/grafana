package webhooks

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioningapis "github.com/grafana/grafana/pkg/registry/apis/provisioning"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/webhooks/pullrequest"
)

// Webhook endpoint max size (25MB)
// See https://docs.github.com/en/webhooks/webhook-events-and-payloads
const webhookMaxBodySize = 25 * 1024 * 1024

// This only works for github right now
type webhookConnector struct {
	webhooksEnabled bool
	core            *provisioningapis.APIBuilder
	renderer        pullrequest.ScreenshotRenderer
}

func NewWebhookConnector(
	webhooksEnabled bool,
	// TODO: use interface for this
	core *provisioningapis.APIBuilder,
	renderer pullrequest.ScreenshotRenderer,
) *webhookConnector {
	return &webhookConnector{
		webhooksEnabled: webhooksEnabled,
		core:            core,
		renderer:        renderer,
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
	return []string{
		http.MethodPost,
		http.MethodGet, // only useful for browser testing, should be removed
	}
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
	storage[provisioning.RepositoryResourceInfo.StoragePath("webhook")] = s
	return nil
}

func (s *webhookConnector) PostProcessOpenAPI(oas *spec3.OpenAPI) error {
	root := "/apis/" + s.core.GetGroupVersion().String() + "/"
	repoprefix := root + "namespaces/{namespace}/repositories/{name}"
	sub := oas.Paths.Paths[repoprefix+"/webhook"]
	if sub != nil && sub.Get != nil {
		sub.Post.Description = "Currently only supports github webhooks"
	}

	return nil
}

func (s *webhookConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	namespace := request.NamespaceValue(ctx)
	ctx, _, err := identity.WithProvisioningIdentity(ctx, namespace)
	if err != nil {
		return nil, err
	}

	// Get the repository with the worker identity (since the request user is likely anonymous)
	repo, err := s.core.GetRepository(ctx, name)
	if err != nil {
		return nil, err
	}

	return provisioningapis.WithTimeout(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger := logging.FromContext(r.Context()).With("logger", "webhook-connector", "repo", name)
		ctx := logging.Context(r.Context(), logger)
		if !s.webhooksEnabled {
			responder.Error(errors.NewBadRequest("webhooks are not enabled"))
			return
		}

		hooks, ok := repo.(WebhookRepository)
		if !ok {
			responder.Error(errors.NewBadRequest("the repository does not support webhooks"))
			return
		}

		// Limit the webhook request body size
		r.Body = http.MaxBytesReader(w, r.Body, webhookMaxBodySize)

		rsp, err := hooks.Webhook(ctx, r)
		if err != nil {
			responder.Error(err)
			return
		}

		if rsp == nil {
			responder.Error(fmt.Errorf("expecting a response"))
			return
		}

		if err := s.updateLastEvent(ctx, repo); err != nil {
			// Continue processing as this is non-critical; the update is purely informational
			logger.Error("failed to update last event", "error", err)
		}

		if rsp.Job != nil {
			rsp.Job.Repository = name
			job, err := s.core.GetQueue().Insert(ctx, namespace, *rsp.Job)
			if err != nil {
				responder.Error(err)
				return
			}
			responder.Object(rsp.Code, job)
			return
		}

		responder.Object(rsp.Code, rsp)
	}), 30*time.Second), nil
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

	lastEvent := time.UnixMilli(repo.Config().Status.Webhook.LastEvent)
	eventAge := time.Since(lastEvent)

	if repo.Config().Status.Webhook != nil && (eventAge > time.Minute) {
		patchOp := map[string]interface{}{
			"op":    "replace",
			"path":  "/status/webhook/lastEvent",
			"value": time.Now().UnixMilli(),
		}

		if err := patcher.Patch(ctx, repo.Config(), patchOp); err != nil {
			return fmt.Errorf("patch status: %w", err)
		}
	}

	return nil
}

var (
	_ rest.Storage         = (*webhookConnector)(nil)
	_ rest.Connecter       = (*webhookConnector)(nil)
	_ rest.StorageMetadata = (*webhookConnector)(nil)
)
