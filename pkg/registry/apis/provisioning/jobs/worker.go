package jobs

import (
	"context"
	"fmt"
	"log/slog"
	"net/url"

	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/auth"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/storage/unified/blob"
)

type RepoGetter interface {
	GetRepository(ctx context.Context, name string) (repository.Repository, error)
}

var _ Worker = (*JobWorker)(nil)

type JobWorker struct {
	getter      RepoGetter
	parsers     *resources.ParserFactory
	identities  auth.BackgroundIdentityService
	logger      *slog.Logger
	render      rendering.Service
	blobstore   blob.PublicBlobStore
	urlProvider func(namespace string) string
}

func NewJobWorker(
	getter RepoGetter,
	parsers *resources.ParserFactory,
	identities auth.BackgroundIdentityService,
	logger *slog.Logger,
	render rendering.Service,
	blobstore blob.PublicBlobStore,
	urlProvider func(namespace string) string,
) *JobWorker {
	return &JobWorker{
		getter:      getter,
		parsers:     parsers,
		identities:  identities,
		logger:      logger,
		render:      render,
		blobstore:   blobstore,
		urlProvider: urlProvider,
	}
}

func (g *JobWorker) Process(ctx context.Context, job provisioning.Job) (*provisioning.JobStatus, error) {
	logger := g.logger.With("job", job.GetName(), "namespace", job.GetNamespace())
	id, err := g.identities.WorkerIdentity(ctx, job.Name)
	if err != nil {
		return nil, err
	}

	ctx = request.WithNamespace(identity.WithRequester(ctx, id), job.Namespace)
	repoName, ok := job.Labels["repository"]
	if !ok {
		return nil, fmt.Errorf("missing repository name in label")
	}
	logger = logger.With("repository", repoName)

	repo, err := g.getter.GetRepository(ctx, repoName)
	if err != nil {
		return nil, err
	}
	if repo == nil {
		return nil, fmt.Errorf("unknown repository")
	}

	parser, err := g.parsers.GetParser(repo)
	if err != nil {
		return nil, fmt.Errorf("failed to get parser for %s: %w", repo.Config().Name, err)
	}

	replicator, err := resources.NewReplicator(repo, parser, logger)
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
		prRepo, ok := repo.(PullRequestRepo)
		if !ok {
			return nil, fmt.Errorf("repository is not a github repository")
		}

		baseURL, err := url.Parse(g.urlProvider(job.Namespace))
		if err != nil {
			return nil, fmt.Errorf("error parsing base url: %w", err)
		}

		// FIXME: renderer should be in its own package
		renderer := &renderer{
			cfg:       repo.Config(),
			render:    g.render,
			blobstore: g.blobstore,
			id:        id,
		}

		commenter, err := NewPullRequestCommenter(prRepo, parser, logger, renderer, baseURL)
		if err != nil {
			return nil, fmt.Errorf("error creating pull request commenter: %w", err)
		}

		if err := commenter.Process(ctx, job); err != nil {
			return nil, fmt.Errorf("error processing pull request: %w", err)
		}
	case provisioning.JobActionExport:
		err := replicator.Export(ctx)
		if err != nil {
			return nil, err
		}
	default:
	}

	return &provisioning.JobStatus{
		State: "finished", // success
	}, nil
}
