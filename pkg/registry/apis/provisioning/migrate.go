package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

type migrateConnector struct {
	dual       dualwrite.Service
	repoGetter RepoGetter
	jobs       jobs.JobQueue
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

	if !dualwrite.IsReadingLegacyDashboardsAndFolders(ctx, c.dual) {
		return nil, fmt.Errorf("this instance is already reading from unified storage")
	}

	cfg := repo.Config()

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var options provisioning.MigrateJobOptions
		err := json.NewDecoder(r.Body).Decode(&options)
		if err != nil {
			responder.Error(apierrors.NewBadRequest("error decoding MigrateJobOptions from request"))
			return
		}

		job, err := c.jobs.Add(ctx, &provisioning.Job{
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
	}), nil
}

var (
	_ rest.Connecter       = (*migrateConnector)(nil)
	_ rest.Storage         = (*migrateConnector)(nil)
	_ rest.StorageMetadata = (*migrateConnector)(nil)
)
