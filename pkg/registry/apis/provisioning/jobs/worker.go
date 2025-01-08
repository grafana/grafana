package jobs

import (
	"context"
	"fmt"
	"net/url"
	"time"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/auth"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/slogctx"
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
	blobstore   blob.PublicBlobStore
	urlProvider func(namespace string) string
}

func NewJobWorker(
	getter RepoGetter,
	parsers *resources.ParserFactory,
	client client.ProvisioningV0alpha1Interface,
	identities auth.BackgroundIdentityService,
	render rendering.Service,
	blobstore blob.PublicBlobStore,
	urlProvider func(namespace string) string,
) *JobWorker {
	return &JobWorker{
		getter:      getter,
		client:      client,
		parsers:     parsers,
		identities:  identities,
		render:      render,
		blobstore:   blobstore,
		urlProvider: urlProvider,
	}
}

func (g *JobWorker) Process(ctx context.Context, job provisioning.Job) (*provisioning.JobStatus, error) {
	logger := slogctx.From(ctx).With("job", job.GetName(), "namespace", job.GetNamespace())
	ctx = slogctx.To(ctx, logger)

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
	ctx = slogctx.To(ctx, logger)

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

	replicator, err := resources.NewReplicator(repo, parser)
	if err != nil {
		return nil, fmt.Errorf("error creating replicator")
	}

	switch job.Spec.Action {
	case provisioning.JobActionSync:
		started := time.Now()

		// Update the status to indicate that we are working on it
		cfg := repo.Config().DeepCopy()
		status := &provisioning.SyncStatus{
			State:   provisioning.JobStateWorking,
			JobID:   job.GetName(),
			Started: started.UnixMilli(),
		}
		cfg.Status.Sync = *status
		cfg, err := g.client.Repositories(cfg.GetNamespace()).UpdateStatus(ctx, cfg, v1.UpdateOptions{})
		if err != nil {
			return nil, fmt.Errorf("update repository status: %w", err)
		}

		// Sync the repository
		ref, syncError := replicator.Sync(ctx)
		status = &provisioning.SyncStatus{
			State:    provisioning.JobStateFinished,
			JobID:    job.GetName(),
			Hash:     ref,
			Started:  started.UnixMilli(),
			Finished: time.Now().UnixMilli(),
			Message:  []string{},
		}

		if syncError != nil {
			status.State = provisioning.JobStateError
			status.Message = append(status.Message, syncError.Error())
		}

		cfg.Status.Sync = *status
		if _, err := g.client.Repositories(cfg.GetNamespace()).UpdateStatus(ctx, cfg, v1.UpdateOptions{}); err != nil {
			return nil, fmt.Errorf("update repository status: %w", err)
		}

		if syncError != nil {
			return nil, syncError
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

		commenter, err := NewPullRequestCommenter(prRepo, parser, renderer, baseURL)
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
		return nil, fmt.Errorf("unknown job action: %s", job.Spec.Action)
	}

	return &provisioning.JobStatus{
		State: "finished", // success
	}, nil
}
