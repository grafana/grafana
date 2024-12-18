package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

type exportConnector struct {
	repoGetter RepoGetter
	logger     *slog.Logger
	queue      jobs.JobQueue
}

func (*exportConnector) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() returns
	return provisioning.JobResourceInfo.NewFunc()
}

func (*exportConnector) Destroy() {}

func (*exportConnector) NamespaceScoped() bool {
	return true
}

func (*exportConnector) GetSingularName() string {
	return "Export"
}

func (*exportConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (c *exportConnector) ProducesObject(verb string) any {
	return c.New()
}

func (*exportConnector) ConnectMethods() []string {
	return []string{http.MethodPost}
}

func (*exportConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (c *exportConnector) Connect(
	ctx context.Context,
	name string,
	opts runtime.Object,
	responder rest.Responder,
) (http.Handler, error) {
	repo, err := c.repoGetter.GetHealthyRepository(ctx, name)
	if err != nil {
		return nil, err
	}
	ns := repo.Config().GetNamespace()
	logger := c.logger.With("repository", name, "namespace", ns)

	// TODO: We need some way to filter what we export.

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		job, err := c.queue.Add(r.Context(), &provisioning.Job{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: ns,
				Labels: map[string]string{
					"repository": repo.Config().GetName(),
				},
			},
			Spec: provisioning.JobSpec{
				Action: provisioning.JobActionExport,
			},
		})
		if err != nil {
			if _, ok := err.(apierrors.APIStatus); ok {
				responder.Error(err)
			} else {
				responder.Error(apierrors.NewInternalError(fmt.Errorf("failed to create a job from request: %w", err)))
			}
		} else {
			logger.InfoContext(ctx, "created an export job from request",
				"job", job.GetName(),
				"jobns", job.GetNamespace())
			responder.Object(http.StatusOK, job)
		}
	}), nil
}

var (
	_ rest.Connecter            = (*exportConnector)(nil)
	_ rest.Storage              = (*exportConnector)(nil)
	_ rest.Scoper               = (*exportConnector)(nil)
	_ rest.SingularNameProvider = (*exportConnector)(nil)
	_ rest.StorageMetadata      = (*exportConnector)(nil)
)
