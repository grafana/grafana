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

var (
	_ jobs.Worker = (*GithubWorker)(nil)
)

type GithubWorker struct {
	getter         RepoGetter
	resourceClient *resources.ClientFactory
	identities     auth.BackgroundIdentityService
	logger         *slog.Logger
}

// Supports implements jobs.Worker.
func (g *GithubWorker) Supports(ctx context.Context, job *provisioning.Job) bool {
	t, ok := job.Labels["repository.type"]
	if ok && t == "github" {
		return true
	}
	return false // for now
}

// Process implements jobs.Worker.
func (g *GithubWorker) Process(ctx context.Context, job provisioning.Job) (*provisioning.JobStatus, error) {
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

	processor, ok := repo.(repository.JobProcessor)
	if !ok {
		return nil, fmt.Errorf("processor not implemented yet")
	}

	factory := resources.NewReplicatorFactory(g.resourceClient, job.Namespace, repo)
	err = processor.Process(ctx, g.logger, job, factory)
	if err != nil {
		return nil, err
	}
	return &provisioning.JobStatus{
		State: "finished", //success
	}, nil
}
