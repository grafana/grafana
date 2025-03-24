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
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

// TODO: should we have merge migrate and sync connectors and have a single repository job connector?
type migrateConnector struct {
	dual       dualwrite.Service
	repoGetter RepoGetter
	jobs       jobs.Queue
}

func (*migrateConnector) New() runtime.Object {
	return &provisioning.Job{}
}

func (*migrateConnector) Destroy() {}

func (*migrateConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (c *migrateConnector) ProducesObject(verb string) any {
	return c.New()
}

func (*migrateConnector) ConnectMethods() []string {
	return []string{http.MethodPost}
}

func (*migrateConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (c *migrateConnector) Connect(
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
		var options provisioning.MigrateJobOptions
		if err := unmarshalJSON(r, defaultMaxBodySize, &options); err != nil {
			responder.Error(apierrors.NewBadRequest("error decoding MigrateJobOptions from request"))
			return
		}

		job, err := c.jobs.Insert(ctx, &provisioning.Job{
			ObjectMeta: v1.ObjectMeta{
				Namespace: cfg.Namespace,
			},
			Spec: provisioning.JobSpec{
				Action:     provisioning.JobActionMigrate,
				Repository: cfg.Name,
				Migrate:    &options,
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
	_ rest.Connecter       = (*migrateConnector)(nil)
	_ rest.Storage         = (*migrateConnector)(nil)
	_ rest.StorageMetadata = (*migrateConnector)(nil)
)
