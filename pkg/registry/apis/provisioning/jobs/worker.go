package jobs

import (
	"context"
	"fmt"

	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/auth"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

type RepoGetter interface {
	GetRepository(ctx context.Context, name string) (repository.Repository, error)
}

var _ Worker = (*JobWorker)(nil)

type JobWorker struct {
	getter            RepoGetter
	identities        auth.BackgroundIdentityService
	syncWorker        RepoJobWorker
	exportWorker      RepoJobWorker
	pullRequestWorker RepoJobWorker
}

func NewJobWorker(
	getter RepoGetter,
	identities auth.BackgroundIdentityService,
	syncWorker RepoJobWorker,
	exportWorker RepoJobWorker,
	pullRequestWorker RepoJobWorker,
) *JobWorker {
	return &JobWorker{
		getter:            getter,
		identities:        identities,
		syncWorker:        syncWorker,
		exportWorker:      exportWorker,
		pullRequestWorker: pullRequestWorker,
	}
}

func (g *JobWorker) Process(ctx context.Context, job provisioning.Job, progress ProgressFn) (*provisioning.JobStatus, error) {
	logger := logging.FromContext(ctx).With("job", job.GetName(), "namespace", job.GetNamespace())
	ctx = logging.Context(ctx, logger)

	id, err := g.identities.WorkerIdentity(ctx, job.Name)
	if err != nil {
		return nil, err
	}

	ctx = request.WithNamespace(identity.WithRequester(ctx, id), job.Namespace)
	repoName := job.Spec.Repository
	logger = logger.With("repository", repoName)
	ctx = logging.Context(ctx, logger)

	repo, err := g.getter.GetRepository(ctx, repoName)
	if err != nil {
		return nil, err
	}
	if repo == nil {
		return nil, fmt.Errorf("unknown repository")
	}

	switch job.Spec.Action {
	case provisioning.JobActionSync:
		return g.syncWorker.Process(ctx, repo, job, progress)
	case provisioning.JobActionPullRequest:
		return g.pullRequestWorker.Process(ctx, repo, job, progress)
	// parser, err := g.parsers.GetParser(ctx, repo)
	// if err != nil {
	// 	return nil, fmt.Errorf("failed to get parser for %s: %w", repo.Config().Name, err)
	// }
	//
	//
	// renderer := pullrequest.NewRenderer(repo.Config(), g.render, g.blobstore, id)
	//
	//
	// commenter, err := pullrequest.NewPullRequestWorker(prRepo, parser, renderer, baseURL)
	// if err != nil {
	// 	return nil, fmt.Errorf("error creating pull request commenter: %w", err)
	// }
	// return commenter.Process(ctx, repo, *options, progress)
	case provisioning.JobActionExport:
		return g.exportWorker.Process(ctx, repo, job, progress)
	default:
		return nil, fmt.Errorf("unknown job action: %s", job.Spec.Action)
	}
}
