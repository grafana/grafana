package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/auth"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

var (
	_ jobs.Worker = (*JobWorker)(nil)
)

// FIXME: this is in the root package and should not be -- when we pull the processing steps out
// of the github repo directly, we should move it to a more appropriate place
type JobWorker struct {
	client         *resources.ClientFactory
	getter         RepoGetter
	resourceClient *resources.ClientFactory
	identities     auth.BackgroundIdentityService
	logger         *slog.Logger
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

	factory := resources.NewReplicatorFactory(g.resourceClient, job.Namespace, repo)
	replicator, err := factory.New()
	if err != nil {
		return nil, fmt.Errorf("error creating replicator")
	}

	processor, ok := repo.(repository.JobProcessor)
	if !ok {
		// TODO... handle sync job for everything
		// EG, move over the "import" logic here
		return nil, fmt.Errorf("job not supported by this worker")
	}

	status, err := processor.Process(ctx, g.logger, job, replicator)
	if err != nil {
		return nil, err
	}
	if status != nil {
		dynamicClient, _, err := g.client.New(job.Namespace)
		if err != nil {
			return nil, fmt.Errorf("failed to create dynamic client: %w", err)
		}

		// TODO: Can we use typed client for this?
		client := dynamicClient.Resource(provisioning.RepositoryResourceInfo.GroupVersionResource())
		unstructuredResource := &unstructured.Unstructured{}
		jj, _ := json.Marshal(repo.Config())
		err = json.Unmarshal(jj, &unstructuredResource.Object)
		if err != nil {
			return nil, fmt.Errorf("error loading config json: %w", err)
		}

		if err := unstructured.SetNestedField(unstructuredResource.Object, status.CurrentGitCommit, "status", "currentGitCommit"); err != nil {
			return nil, fmt.Errorf("set currentGitCommit: %w", err)
		}

		if _, err := client.UpdateStatus(ctx, unstructuredResource, metav1.UpdateOptions{}); err != nil {
			return nil, fmt.Errorf("update repository status: %w", err)
		}
	}
	return &provisioning.JobStatus{
		State: "finished", //success
	}, nil
}
