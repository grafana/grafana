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
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type exportConnector struct {
	repoGetter RepoGetter
	jobs       jobs.Queue
}

func (*exportConnector) New() runtime.Object {
	return &provisioning.Job{}
}

func (*exportConnector) Destroy() {}

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

func (c *exportConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	repo, err := c.repoGetter.GetRepository(ctx, name)
	if err != nil {
		return nil, err
	}
	cfg := repo.Config()
	if err := repository.IsWriteAllowed(cfg, ""); err != nil {
		return nil, err
	}

	return withTimeout(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		options := &provisioning.ExportJobOptions{}
		if err := unmarshalJSON(r, defaultMaxBodySize, options); err != nil {
			responder.Error(apierrors.NewBadRequest(err.Error()))
			return
		}
		job, err := c.jobs.Insert(ctx, &provisioning.Job{
			ObjectMeta: v1.ObjectMeta{
				Namespace: cfg.Namespace,
			},
			Spec: provisioning.JobSpec{
				Action:     provisioning.JobActionExport,
				Repository: cfg.Name,
				Push:       options,
			},
		})
		if err != nil {
			responder.Error(err)
		} else {
			responder.Object(http.StatusAccepted, job)
		}
	}), 30*time.Second), nil
}

var (
	_ rest.Connecter       = (*exportConnector)(nil)
	_ rest.Storage         = (*exportConnector)(nil)
	_ rest.StorageMetadata = (*exportConnector)(nil)
)
