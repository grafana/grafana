package jobs

import (
	"context"
	"fmt"
	"net/url"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/auth"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/export"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/pullrequest"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/storage/unified/blob"
)

type SyncWorker interface {
	Process(
		ctx context.Context,
		repo repository.Repository,
		job provisioning.Job,
		progress func(provisioning.JobStatus) error,
	) (*provisioning.JobStatus, error)
}

type RepoGetter interface {
	GetRepository(ctx context.Context, name string) (repository.Repository, error)
}

var _ Worker = (*JobWorker)(nil)

type JobWorker struct {
	getter      RepoGetter
	parsers     *resources.ParserFactory
	identities  auth.BackgroundIdentityService
	render      rendering.Service
	lister      resources.ResourceLister
	blobstore   blob.PublicBlobStore
	urlProvider func(namespace string) string
	syncWorker  SyncWorker
}

func NewJobWorker(
	getter RepoGetter,
	parsers *resources.ParserFactory,
	identities auth.BackgroundIdentityService,
	render rendering.Service,
	lister resources.ResourceLister,
	syncWorker SyncWorker,
	blobstore blob.PublicBlobStore,
	urlProvider func(namespace string) string,
) *JobWorker {
	return &JobWorker{
		getter:      getter,
		parsers:     parsers,
		identities:  identities,
		render:      render,
		lister:      lister,
		blobstore:   blobstore,
		urlProvider: urlProvider,
		syncWorker:  syncWorker,
	}
}

func (g *JobWorker) Process(ctx context.Context, job provisioning.Job, progress func(provisioning.JobStatus) error) (*provisioning.JobStatus, error) {
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

	parser, err := g.parsers.GetParser(ctx, repo)
	if err != nil {
		return nil, fmt.Errorf("failed to get parser for %s: %w", repo.Config().Name, err)
	}

	switch job.Spec.Action {
	case provisioning.JobActionSync:
		return g.syncWorker.Process(ctx, repo, job, progress)
	case provisioning.JobActionPullRequest:
		prRepo, ok := repo.(pullrequest.PullRequestRepo)
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

		options := job.Spec.PullRequest
		if options == nil {
			return nil, apierrors.NewBadRequest("missing spec.pr")
		}

		commenter, err := pullrequest.NewPullRequestWorker(prRepo, parser, renderer, baseURL)
		if err != nil {
			return nil, fmt.Errorf("error creating pull request commenter: %w", err)
		}
		return commenter.Process(ctx, repo, *options, progress)

	case provisioning.JobActionExport:
		if job.Spec.Export == nil {
			return &provisioning.JobStatus{
				State:  provisioning.JobStateError,
				Errors: []string{"Export job missing export settings"},
			}, nil
		}

		if repo.Config().Spec.ReadOnly {
			return &provisioning.JobStatus{
				State:  provisioning.JobStateError,
				Errors: []string{"Exporting to a read only repository is not supported"},
			}, nil
		}

		var exporter export.ExportWorker
		// Test for now... so we have something with long spinners for UI testing!!!
		if job.Spec.Export.Branch == "*dummy*" {
			exporter = export.NewDummyExportWorker()
		} else {
			exporter, err = export.NewExportWorker(repo, parser.Client())
			if err != nil {
				return nil, err
			}
		}
		return exporter.Export(ctx, repo, *job.Spec.Export, progress)

	default:
		return nil, fmt.Errorf("unknown job action: %s", job.Spec.Action)
	}
}
