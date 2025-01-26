package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	client "github.com/grafana/grafana/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
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
	client      client.ProvisioningV0alpha1Interface
	getter      RepoGetter
	parsers     *resources.ParserFactory
	identities  auth.BackgroundIdentityService
	render      rendering.Service
	lister      resources.ResourceLister
	blobstore   blob.PublicBlobStore
	urlProvider func(namespace string) string
}

func NewJobWorker(
	getter RepoGetter,
	parsers *resources.ParserFactory,
	client client.ProvisioningV0alpha1Interface,
	identities auth.BackgroundIdentityService,
	render rendering.Service,
	lister resources.ResourceLister,
	blobstore blob.PublicBlobStore,
	urlProvider func(namespace string) string,
) *JobWorker {
	return &JobWorker{
		getter:      getter,
		client:      client,
		parsers:     parsers,
		identities:  identities,
		render:      render,
		lister:      lister,
		blobstore:   blobstore,
		urlProvider: urlProvider,
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
		return g.doSync(ctx, repo, job, parser, progress)

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

		options := job.Spec.PullRequest
		if options == nil {
			return nil, apierrors.NewBadRequest("missing spec.pr")
		}

		commenter, err := NewPullRequestCommenter(prRepo, parser, renderer, baseURL)
		if err != nil {
			return nil, fmt.Errorf("error creating pull request commenter: %w", err)
		}
		return commenter.ProcessPullRequest(ctx, repo, *options, progress)

	case provisioning.JobActionExport:
		if job.Spec.Export == nil {
			return &provisioning.JobStatus{
				State:  provisioning.JobStateError,
				Errors: []string{"Export job missing export settings"},
			}, nil
		}

		var exporter Exporter

		// Test for now... so we have something with long spinners for UI testing!!!
		if job.Spec.Export.Branch == "*dummy*" {
			exporter = &dummyExporter{}
		} else {
			exporter, err = NewExporter(repo, parser)
			if err != nil {
				return nil, err
			}
		}
		return exporter.Export(ctx, repo, *job.Spec.Export, progress)

	default:
		return nil, fmt.Errorf("unknown job action: %s", job.Spec.Action)
	}
}

func (g *JobWorker) doSync(ctx context.Context,
	repo repository.Repository,
	job provisioning.Job,
	parser *resources.Parser,
	_ func(provisioning.JobStatus) error,
) (*provisioning.JobStatus, error) {
	var err error
	cfg := repo.Config()

	status := job.Status.ToSyncStatus(job.Name)
	patch, err := json.Marshal(map[string]any{
		"status": map[string]any{
			"sync": status,
		},
	})
	if err != nil {
		return nil, err
	}

	fmt.Printf("SEND PATCH (starting): %s\n", (patch))
	cfg, err = g.client.Repositories(cfg.Namespace).
		Patch(ctx, cfg.Name, types.MergePatchType, patch, v1.PatchOptions{}, "status")
	if err != nil {
		logger.Warn("unable to update repo with job status", "err", err)
	}

	syncer, err := NewSyncer(repo, g.lister, parser)
	if err != nil {
		return nil, fmt.Errorf("error creating replicator")
	}

	var complete bool
	if job.Spec.Sync != nil && job.Spec.Sync.Complete {
		complete = job.Spec.Sync.Complete
	}

	// Sync the repository
	ref, syncError := syncer.Sync(ctx, complete)
	status = job.Status.ToSyncStatus(job.Name)
	status.Hash = ref

	// Update the resource stats
	stats, err := g.lister.Stats(ctx, cfg.Namespace, cfg.Name)
	if err != nil {
		logger.Warn("unable to read stats", "error", err)
	}
	if stats == nil {
		stats = &provisioning.ResourceStats{}
	}

	patch, err = json.Marshal(map[string]any{
		"status": map[string]any{
			"sync":  status,
			"stats": stats.Items,
		},
	})

	fmt.Printf("SEND PATCH (after): %s\n", (patch))
	cfg, err = g.client.Repositories(cfg.Namespace).
		Patch(ctx, cfg.Name, types.MergePatchType, patch, v1.PatchOptions{}, "status")
	if err != nil {
		logger.Warn("unable to update repo with job status", "err", err)
	}

	if syncError != nil {
		return nil, syncError
	}

	return &provisioning.JobStatus{
		State: provisioning.JobStateSuccess,
	}, nil
}
