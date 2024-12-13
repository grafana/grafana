package provisioning

import (
	"context"
	"fmt"
	"log/slog"

	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/auth"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

var _ jobs.Worker = (*JobWorker)(nil)

// FIXME: this is in the root package and should not be -- when we pull the processing steps out
// of the github repo directly, we should move it to a more appropriate place
type JobWorker struct {
	getter         RepoGetter
	resourceClient *resources.ClientFactory
	identities     auth.BackgroundIdentityService
	logger         *slog.Logger
	ignore         provisioning.IgnoreFile
}

// Process implements jobs.Worker.
func (g *JobWorker) Process(ctx context.Context, job provisioning.Job) (*provisioning.JobStatus, error) {
	id, err := g.identities.WorkerIdentity(ctx, job.Name)
	if err != nil {
		return nil, err
	}

	ctx = request.WithNamespace(identity.WithRequester(ctx, id), job.Namespace)
	repoName, ok := job.Labels["repository"]
	if !ok {
		return nil, fmt.Errorf("missing repository name in label")
	}

	repo, err := g.getter.GetRepository(ctx, repoName)
	if err != nil {
		return nil, err
	}
	if repo == nil {
		return nil, fmt.Errorf("unknown repository")
	}

	factory := resources.NewReplicatorFactory(g.resourceClient, job.Namespace, repo, g.ignore)
	replicator, err := factory.New()
	if err != nil {
		return nil, fmt.Errorf("error creating replicator")
	}

	switch job.Spec.Action {
	case provisioning.JobActionSync:
		err := replicator.Sync(ctx)
		if err != nil {
			return nil, err
		}
	case provisioning.JobActionPullRequest:
		// TODO: this interface is only for JobProcessor
		processor, ok := repo.(repository.JobProcessor)
		if !ok {
			// TODO... handle sync job for everything
			// EG, move over the "import" logic here
			return nil, fmt.Errorf("job not supported by this worker")
		}
		err := processor.Process(ctx, g.logger, job, replicator)
		if err != nil {
			return nil, err
		}
	default:
	}

	return &provisioning.JobStatus{
		State: "finished", // success
	}, nil
}
