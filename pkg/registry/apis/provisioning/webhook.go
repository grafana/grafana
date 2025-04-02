package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

// Webhook endpoint max size (25MB)
// See https://docs.github.com/en/webhooks/webhook-events-and-payloads
const webhookMaxBodySize = 25 * 1024 * 1024

// This only works for github right now
type webhookConnector struct {
	client          ClientGetter
	getter          RepoGetter
	jobs            jobs.Queue
	webhooksEnabled bool
}

func NewWebhookConnector(client ClientGetter, getter RepoGetter, jobs jobs.Queue, webhooksEnabled bool) *webhookConnector {
	return &webhookConnector{
		client:          client,
		getter:          getter,
		jobs:            jobs,
		webhooksEnabled: webhooksEnabled,
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

func (s *webhookConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	namespace := request.NamespaceValue(ctx)
	ctx, _, err := identity.WithProvisioningIdentity(ctx, namespace)
	if err != nil {
		return nil, err
	}

	// Get the repository with the worker identity (since the request user is likely anonymous)
	repo, err := s.getter.GetHealthyRepository(ctx, name)
	if err != nil {
		return nil, err
	}

	return withTimeout(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger := logging.FromContext(r.Context()).With("logger", "webhook-connector", "repo", name)
		ctx := logging.Context(r.Context(), logger)
		if !s.webhooksEnabled {
			responder.Error(errors.NewBadRequest("webhooks are not enabled"))
			return
		}

		hooks, ok := repo.(repository.Hooks)
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

		if err := s.updateLastEvent(ctx, repo, name, namespace); err != nil {
			// Continue processing as this is non-critical; the update is purely informational
			logger.Error("failed to update last event", "error", err)
		}

		if rsp.Job != nil {
			rsp.Job.Repository = name
			job, err := s.jobs.Insert(ctx, namespace, *rsp.Job)
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
func (s *webhookConnector) updateLastEvent(ctx context.Context, repo repository.Repository, name, namespace string) error {
	client := s.client.GetClient()
	if client == nil {
		// This would only happen if we wired things up incorrectly
		return fmt.Errorf("client is nil")
	}

	lastEvent := time.UnixMilli(repo.Config().Status.Webhook.LastEvent)
	eventAge := time.Since(lastEvent)

	if repo.Config().Status.Webhook != nil && (eventAge > time.Minute) {
		patchOp := map[string]interface{}{
			"op":    "replace",
			"path":  "/status/webhook/lastEvent",
			"value": time.Now().UnixMilli(),
		}

		patch, err := json.Marshal([]map[string]interface{}{patchOp})
		if err != nil {
			return fmt.Errorf("marshal patch: %w", err)
		}

		if _, err = client.Repositories(namespace).
			Patch(ctx, name, types.JSONPatchType, patch, metav1.PatchOptions{}, "status"); err != nil {
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
