package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/auth"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

// This only works for github right now
type webhookConnector struct {
	client auth.BackgroundIdentityService
	getter RepoGetter
	logger *slog.Logger
	jobs   jobs.JobQueue
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
	id, err := s.client.WorkerIdentity(ctx, namespace)
	if err != nil {
		return nil, err
	}

	// Get the repository with the worker identity (since the request user is likely anonymous)
	repo, err := s.getter.GetHealthyRepository(identity.WithRequester(ctx, id), name)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger := s.logger.With("repo", name)
		rsp, err := repo.Webhook(ctx, logger, r)
		if err != nil {
			responder.Error(err)
			return
		}
		if rsp == nil {
			responder.Error(fmt.Errorf("expecting a response"))
			return
		}
		if rsp.Job != nil {
			// Add the job to the job queue
			job := &provisioning.Job{
				ObjectMeta: v1.ObjectMeta{
					Namespace: namespace,
					Labels: map[string]string{
						"repository": name,
					},
				},
				Spec: *rsp.Job,
			}
			job, err := s.jobs.Add(ctx, job)
			if err != nil {
				responder.Error(err)
				return
			}
			responder.Object(rsp.Code, job)
			return
		}
		responder.Object(rsp.Code, rsp)
	}), nil
}

var (
	_ rest.Storage         = (*webhookConnector)(nil)
	_ rest.Connecter       = (*webhookConnector)(nil)
	_ rest.StorageMetadata = (*webhookConnector)(nil)
)
