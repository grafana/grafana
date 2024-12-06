package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"path/filepath"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/auth"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// This only works for github right now
type webhookConnector struct {
	client         auth.BackgroundIdentityService
	getter         RepoGetter
	logger         *slog.Logger
	resourceClient *resources.ClientFactory
}

func (*webhookConnector) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() returns
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
	id, err := s.client.WorkerIdentity(ctx, namespace)
	if err != nil {
		return nil, err
	}

	// Get the repository with the worker identity (since the request user is likely anonymous)
	repo, err := s.getter.GetRepository(identity.WithRequester(ctx, id), name)
	if err != nil {
		return nil, err
	}

	ignoreable := func(p string) bool {
		ext := filepath.Ext(p)
		if ext == "yaml" || ext == "json" {
			return false
		}
		return true
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger := s.logger.With("repo", name)
		rsp, err := repo.Webhook(ctx, logger, ignoreable, r)
		if err != nil {
			responder.Error(err)
			return
		}
		if rsp == nil {
			responder.Error(fmt.Errorf("expecting a response"))
			return
		}
		if len(rsp.Jobs) > 0 {
			go func() {
				// Async process the jobs
				// TODO!!! this should be a job queue
				ctx := identity.WithRequester(context.Background(), id)
				factory := resources.NewReplicatorFactory(s.resourceClient, namespace, repo)
				for _, job := range rsp.Jobs {
					err := repo.Process(ctx, logger, job, factory)
					if err != nil {
						logger.Error("error running job", "error", err)
					}
				}
			}()
		}

		responder.Object(rsp.Code, &metav1.Status{
			Message: rsp.Message,
		})

	}), nil
}

var (
	_ rest.Storage         = (*webhookConnector)(nil)
	_ rest.Connecter       = (*webhookConnector)(nil)
	_ rest.StorageMetadata = (*webhookConnector)(nil)
)
