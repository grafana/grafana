package provisioning

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

type jobsConnector struct {
	repoGetter RepoGetter
	jobs       jobs.Queue
	historic   jobs.History
}

func (*jobsConnector) New() runtime.Object {
	return &provisioning.Repository{}
}

func (*jobsConnector) Destroy() {}

func (*jobsConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (c *jobsConnector) ProducesObject(verb string) any {
	return &provisioning.Job{}
}

func (*jobsConnector) ConnectMethods() []string {
	return []string{http.MethodPost, http.MethodGet}
}

func (*jobsConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, "" // path -> uid
}

func (c *jobsConnector) Connect(
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
		ctx = r.Context()
		prefix := fmt.Sprintf("/%s/jobs/", name)
		idx := strings.Index(r.URL.Path, prefix)
		if r.Method == http.MethodGet {
			if idx > 0 {
				jobUID := r.URL.Path[idx+len(prefix):]
				if !validBlobID(jobUID) {
					responder.Error(apierrors.NewBadRequest(fmt.Sprintf("invalid job uid: %s", jobUID)))
					return
				}
				job, err := c.historic.GetJob(ctx, cfg.Namespace, name, jobUID)
				if err != nil {
					responder.Error(err)
					return
				}
				responder.Object(http.StatusOK, job)
				return
			}
			recent, err := c.historic.RecentJobs(ctx, cfg.Namespace, name)
			if err != nil {
				responder.Error(err)
				return
			}
			responder.Object(http.StatusOK, recent)
			return
		}
		if idx > 0 {
			responder.Error(apierrors.NewBadRequest("can not post to a job UID"))
			return
		}

		spec := provisioning.JobSpec{}
		if err := unmarshalJSON(r, defaultMaxBodySize, &spec); err != nil {
			responder.Error(apierrors.NewBadRequest("error decoding provisioning.Job from request"))
			return
		}
		spec.Repository = name

		job, err := c.jobs.Insert(ctx, cfg.Namespace, spec)
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(http.StatusAccepted, job)
	}), 30*time.Second), nil
}

var (
	_ rest.Connecter       = (*jobsConnector)(nil)
	_ rest.Storage         = (*jobsConnector)(nil)
	_ rest.StorageMetadata = (*jobsConnector)(nil)
)
