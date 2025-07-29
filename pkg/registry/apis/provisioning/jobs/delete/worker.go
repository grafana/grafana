package delete

import (
	"context"
	"errors"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type Worker struct {
	syncWorker       jobs.Worker
	wrapFn           repository.WrapWithStageFn
	resourcesFactory resources.RepositoryResourcesFactory
}

func NewWorker(syncWorker jobs.Worker, wrapFn repository.WrapWithStageFn, resourcesFactory resources.RepositoryResourcesFactory) *Worker {
	return &Worker{
		syncWorker:       syncWorker,
		wrapFn:           wrapFn,
		resourcesFactory: resourcesFactory,
	}
}

func (w *Worker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionDelete
}

func (w *Worker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	if job.Spec.Delete == nil {
		return errors.New("missing delete settings")
	}

	opts := *job.Spec.Delete
	paths := opts.Paths

	progress.SetTotal(ctx, len(paths)+len(opts.Resources))
	progress.StrictMaxErrors(1) // Fail fast on any error during deletion

	fn := func(repo repository.Repository, _ bool) error {
		rw, ok := repo.(repository.ReaderWriter)
		if !ok {
			return errors.New("delete job submitted targeting repository that is not a ReaderWriter")
		}

		// Resolve ResourceRef entries to file paths using RepositoryResources
		if len(opts.Resources) > 0 {
			resolvedPaths, err := w.resolveResourcesToPaths(ctx, rw, progress, opts.Resources)
			if err != nil {
				return err
			}
			paths = append(paths, resolvedPaths...)
		}

		return w.deleteFiles(ctx, rw, progress, opts, paths...)
	}

	msg := fmt.Sprintf("Delete from Grafana %s", job.Name)
	stageOptions := repository.StageOptions{
		Mode:                  repository.StageModeCommitOnlyOnce,
		CommitOnlyOnceMessage: msg,
		PushOnWrites:          false,
		Timeout:               10 * time.Minute,
	}

	err := w.wrapFn(ctx, repo, stageOptions, fn)
	if err != nil {
		return fmt.Errorf("delete files from repository: %w", err)
	}

	if opts.Ref == "" {
		progress.ResetResults()
		progress.SetMessage(ctx, "pull resources")

		syncJob := provisioning.Job{
			Spec: provisioning.JobSpec{
				Pull: &provisioning.SyncJobOptions{
					// Full sync because it's the only one that supports empty folder deletion
					Incremental: false,
				},
			},
		}

		if err := w.syncWorker.Process(ctx, repo, syncJob, progress); err != nil {
			return fmt.Errorf("pull resources: %w", err)
		}
	}

	return nil
}

func (w *Worker) deleteFiles(ctx context.Context, rw repository.ReaderWriter, progress jobs.JobProgressRecorder, opts provisioning.DeleteJobOptions, paths ...string) error {
	for _, path := range paths {
		result := jobs.JobResourceResult{
			Path:   path,
			Action: repository.FileActionDeleted,
		}

		progress.SetMessage(ctx, "Deleting "+path)
		result.Error = rw.Delete(ctx, path, opts.Ref, "Delete "+path)
		progress.Record(ctx, result)
		if err := progress.TooManyErrors(); err != nil {
			return err
		}
	}

	return nil
}

// resolveResourcesToPaths converts ResourceRef entries to file paths, recording errors for individual resources
func (w *Worker) resolveResourcesToPaths(ctx context.Context, rw repository.ReaderWriter, progress jobs.JobProgressRecorder, resources []provisioning.ResourceRef) ([]string, error) {
	if len(resources) == 0 {
		return nil, nil
	}

	progress.SetMessage(ctx, "Resolving resource paths")
	repositoryResources, err := w.resourcesFactory.Client(ctx, rw)
	if err != nil {
		return nil, fmt.Errorf("create repository resources client: %w", err)
	}

	resolvedPaths := make([]string, 0, len(resources))
	for _, resource := range resources {
		result := jobs.JobResourceResult{
			Name:   resource.Name,
			Group:  resource.Group,
			Action: repository.FileActionDeleted, // Will be used for deletion later
		}

		gvk := schema.GroupVersionKind{
			Group: resource.Group,
			Kind:  resource.Kind,
			// Version is left empty so ForKind will use the preferred version
		}

		progress.SetMessage(ctx, fmt.Sprintf("Finding path for resource %s/%s/%s", resource.Group, resource.Kind, resource.Name))
		resourcePath, err := repositoryResources.FindResourcePath(ctx, resource.Name, gvk)
		if err != nil {
			result.Error = fmt.Errorf("find path for resource %s/%s/%s: %w", resource.Group, resource.Kind, resource.Name, err)
			progress.Record(ctx, result)
			// Continue with next resource instead of failing fast
			if err := progress.TooManyErrors(); err != nil {
				return resolvedPaths, err
			}
			continue
		}

		result.Path = resourcePath
		resolvedPaths = append(resolvedPaths, resourcePath)
	}

	return resolvedPaths, nil
}
