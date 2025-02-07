package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
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
	render      rendering.Service
	lister      resources.ResourceLister
	blobstore   blob.PublicBlobStore
	urlProvider func(namespace string) string
	syncer      Syncer
}

func NewJobWorker(
	getter RepoGetter,
	parsers *resources.ParserFactory,
	client client.ProvisioningV0alpha1Interface,
	render rendering.Service,
	lister resources.ResourceLister,
	blobstore blob.PublicBlobStore,
	urlProvider func(namespace string) string,
) *JobWorker {
	return &JobWorker{
		getter:      getter,
		client:      client,
		parsers:     parsers,
		render:      render,
		lister:      lister,
		blobstore:   blobstore,
		urlProvider: urlProvider,
		syncer: &syncer{
			parsers: parsers,
			lister:  lister,
		},
	}
}

func (g *JobWorker) Process(ctx context.Context, job provisioning.Job, progress func(provisioning.JobStatus) error) (*provisioning.JobStatus, error) {
	logger := logging.FromContext(ctx).With("job", job.GetName(), "namespace", job.GetNamespace())
	ctx = logging.Context(ctx, logger)

	ctx = request.WithNamespace(ctx, job.Namespace)
	ctx, id, err := identity.WithProvisioningIdentitiy(ctx, job.Namespace)
	if err != nil {
		return nil, err
	}

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
		return g.doSync(ctx, repo, job, progress)

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

		if repo.Config().Spec.ReadOnly {
			return &provisioning.JobStatus{
				State:  provisioning.JobStateError,
				Errors: []string{"Exporting to a read only repository is not supported"},
			}, nil
		}

		var exporter Exporter

		// Test for now... so we have something with long spinners for UI testing!!!
		if job.Spec.Export.Branch == "*dummy*" {
			exporter = &dummyExporter{}
		} else {
			exporter, err = NewExporter(repo, parser.Client())
			if err != nil {
				return nil, err
			}
		}
		return exporter.Export(ctx, repo, *job.Spec.Export, progress)

	default:
		return nil, fmt.Errorf("unknown job action: %s", job.Spec.Action)
	}
}

// The Syncer will synchronize the external repo with grafana database
// this function updates the status for both the job and the referenced repository
func (g *JobWorker) doSync(ctx context.Context,
	repo repository.Repository,
	job provisioning.Job,
	progress func(provisioning.JobStatus) error,
) (*provisioning.JobStatus, error) {
	var err error
	cfg := repo.Config()

	logger := logging.FromContext(ctx).With("job", job.GetName(), "namespace", job.GetNamespace())
	patch, err := json.Marshal(map[string]any{
		"status": map[string]any{
			"sync": job.Status.ToSyncStatus(job.Name),
		},
	})
	if err != nil {
		return nil, err
	}

	cfg, err = g.client.Repositories(cfg.Namespace).
		Patch(ctx, cfg.Name, types.MergePatchType, patch, v1.PatchOptions{}, "status")
	if err != nil {
		logger.Warn("unable to update repo with job status", "err", err)
	}

	// Execute the sync task
	jobStatus, syncStatus, syncError := g.syncer.Sync(ctx, repo, *job.Spec.Sync, progress)
	if syncStatus == nil {
		syncStatus = &provisioning.SyncStatus{}
	}
	syncStatus.JobID = job.Name
	syncStatus.Started = job.Status.Started
	syncStatus.Finished = time.Now().UnixMilli()
	if syncError != nil {
		syncStatus.State = provisioning.JobStateError
		syncStatus.Message = []string{
			"error running sync",
			syncError.Error(),
		}
	} else if syncStatus.State == "" {
		syncStatus.State = provisioning.JobStateSuccess
	}

	// Update the resource stats -- give the index some time to catch up
	time.Sleep(1 * time.Second)
	stats, err := g.lister.Stats(ctx, cfg.Namespace, cfg.Name)
	if err != nil {
		logger.Warn("unable to read stats", "error", err)
	}
	if stats == nil {
		stats = &provisioning.ResourceStats{}
	}

	patch, err = json.Marshal(map[string]any{
		"status": map[string]any{
			"sync":  syncStatus,
			"stats": stats.Items,
		},
	})
	if err != nil {
		return nil, err
	}

	_, err = g.client.Repositories(cfg.Namespace).
		Patch(ctx, cfg.Name, types.MergePatchType, patch, v1.PatchOptions{}, "status")
	if err != nil {
		logger.Warn("unable to update repo with job status", "err", err)
	}

	if syncError != nil {
		return nil, syncError
	}
	return jobStatus, nil
}
