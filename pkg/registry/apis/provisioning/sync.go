package provisioning

import (
	"context"
	"net/http"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

// TODO: should we have merge migrate and sync connectors and have a single repository job connector?
type syncConnector struct {
	repoGetter RepoGetter
	jobs       jobs.Queue
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

	return withTimeout(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var options provisioning.SyncJobOptions

		if err := unmarshalJSON(r, defaultMaxBodySize, &options); err != nil {
			responder.Error(apierrors.NewBadRequest("error decoding SyncJobOptions from request"))
			return
		}

		job, err := c.jobs.Insert(ctx, &provisioning.Job{
			ObjectMeta: v1.ObjectMeta{
				Namespace: cfg.Namespace,
			},
			Spec: provisioning.JobSpec{
				Action:     provisioning.JobActionSync,
				Repository: cfg.Name,
				Pull:       &options,
			},
		})
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(http.StatusAccepted, job)
	}), 30*time.Second), nil
}

var (
	_ rest.Connecter       = (*syncConnector)(nil)
	_ rest.Storage         = (*syncConnector)(nil)
	_ rest.StorageMetadata = (*syncConnector)(nil)
)
