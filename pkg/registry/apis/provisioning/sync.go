package provisioning

import (
	"context"
	"log/slog"
	"net/http"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

type syncConnector struct {
	repoGetter RepoGetter
	logger     *slog.Logger
	jobs       jobs.JobQueue
}

func (*syncConnector) New() runtime.Object {
	return &provisioning.Job{}
}

func (*syncConnector) Destroy() {}

func (*syncConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (c *syncConnector) ProducesObject(verb string) any {
	return c.New()
}

func (*syncConnector) ConnectMethods() []string {
	return []string{http.MethodPost}
}

func (*syncConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (c *syncConnector) Connect(
	ctx context.Context,
	name string,
	opts runtime.Object,
	responder rest.Responder,
) (http.Handler, error) {
	repo, err := c.repoGetter.GetHealthyRepository(ctx, name)
	if err != nil {
		return nil, err
	}
	cfg := repo.Config()

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		job, err := c.jobs.Add(ctx, &provisioning.Job{
			ObjectMeta: v1.ObjectMeta{
				Namespace: cfg.Namespace,
				Labels: map[string]string{
					"repository": cfg.Name,
				},
			},
			Spec: provisioning.JobSpec{
				Action: provisioning.JobActionSync,
			},
		})
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(http.StatusAccepted, job)
	}), nil
}

var (
	_ rest.Connecter       = (*syncConnector)(nil)
	_ rest.Storage         = (*syncConnector)(nil)
	_ rest.StorageMetadata = (*syncConnector)(nil)
)
