package move

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/utils"
)

type Worker struct {
	syncWorker       jobs.Worker
	wrapFn           repository.WrapWithStageFn
	resourcesFactory resources.RepositoryResourcesFactory
	metrics          jobs.JobMetrics
}

func NewWorker(syncWorker jobs.Worker, wrapFn repository.WrapWithStageFn, resourcesFactory resources.RepositoryResourcesFactory, metrics jobs.JobMetrics) *Worker {
	return &Worker{
		syncWorker:       syncWorker,
		wrapFn:           wrapFn,
		resourcesFactory: resourcesFactory,
		metrics:          metrics,
	}
}

func (w *Worker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionMove
}

func (w *Worker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	if job.Spec.Move == nil {
		return errors.New("missing move settings")
	}
	opts := *job.Spec.Move
	logger := logging.FromContext(ctx).With("job", job.GetName(), "namespace", job.GetNamespace())
	outcome := utils.ErrorOutcome
	start := time.Now()
	resourcesMoved := 0
	defer func() {
		w.metrics.RecordJob(string(provisioning.JobActionMove), outcome, resourcesMoved, time.Since(start).Seconds())
	}()

	if opts.TargetPath == "" {
		return errors.New("target path is required for move operation")
	}

	// Validate that target path is a directory (ends with slash)
	if !safepath.IsDir(opts.TargetPath) {
		return errors.New("target path must be a directory (should end with '/')")
	}

	paths := opts.Paths

	progress.SetTotal(ctx, len(paths)+len(opts.Resources))
	progress.StrictMaxErrors(1) // Fail fast on any error during move

	fn := func(repo repository.Repository, _ bool) error {
		rw, ok := repo.(repository.ReaderWriter)
		if !ok {
			logger.Error("move job submitted targeting repository that is not a ReaderWriter")
			return errors.New("move job submitted targeting repository that is not a ReaderWriter")
		}

		// Resolve ResourceRef entries to file paths using RepositoryResources
		if len(opts.Resources) > 0 {
			resolvedPaths, err := w.resolveResourcesToPaths(ctx, rw, progress, opts.Resources)
			if err != nil {
				return err
			}
			paths = append(paths, resolvedPaths...)
		}

		// Deduplicate paths to avoid attempting to move the same file multiple times
		paths = deduplicatePaths(paths)

		return w.moveFiles(ctx, rw, progress, opts, paths...)
	}

	msg := fmt.Sprintf("Move files from Grafana %s", job.Name)
	stageOptions := repository.StageOptions{
		Mode:                  repository.StageModeCommitOnlyOnce,
		CommitOnlyOnceMessage: msg,
		PushOnWrites:          false,
		Timeout:               10 * time.Minute,
		Ref:                   opts.Ref,
	}

	err := w.wrapFn(ctx, repo, stageOptions, fn)
	if err != nil {
		logger.Error("failed to move files in repository", "error", err)
		return fmt.Errorf("move files in repository: %w", err)
	}

	// Set RefURLs if the repository supports it and we have a target ref
	if opts.Ref != "" {
		if repoWithURLs, ok := repo.(repository.RepositoryWithURLs); ok {
			if refURLs, urlErr := repoWithURLs.RefURLs(ctx, opts.Ref); urlErr == nil && refURLs != nil {
				progress.SetRefURLs(ctx, refURLs)
			}
		}
	}

	if opts.Ref == "" {
		progress.ResetResults(false)
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
			logger.Error("failed to pull resources", "error", err)
			return fmt.Errorf("pull resources: %w", err)
		}
	}

	outcome = utils.SuccessOutcome
	jobStatus := progress.Complete(ctx, nil)
	for _, summary := range jobStatus.Summary {
		// FileActionRenamed increments both delete & create, use create here
		resourcesMoved += int(summary.Create)
	}

	return nil
}

func (w *Worker) moveFiles(ctx context.Context, rw repository.ReaderWriter, progress jobs.JobProgressRecorder, opts provisioning.MoveJobOptions, paths ...string) error {
	for _, path := range paths {
		resultBuilder := jobs.NewPathOnlyResult(path).WithAction(repository.FileActionRenamed)
		// Construct the target path by combining the job's target path with the file/folder name
		targetPath := w.constructTargetPath(opts.TargetPath, path)

		progress.SetMessage(ctx, "Moving "+path+" to "+targetPath)
		if err := rw.Move(ctx, path, targetPath, opts.Ref, "Move "+path+" to "+targetPath); err != nil {
			resultBuilder.WithError(fmt.Errorf("moving file %s to %s: %w", path, targetPath, err))
		}

		progress.Record(ctx, resultBuilder.Build())
		if err := progress.TooManyErrors(); err != nil {
			return err
		}
	}

	return nil
}

// constructTargetPath combines the job's target path with the file/folder name from the source path
func (w *Worker) constructTargetPath(jobTargetPath, sourcePath string) string {
	// Extract the file/folder name from the source path
	fileName := filepath.Base(sourcePath)

	// If the source path is a directory (ends with slash), preserve the trailing slash in target
	if safepath.IsDir(sourcePath) {
		return jobTargetPath + fileName + "/"
	}

	// For files, just append the filename
	return jobTargetPath + fileName
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
		gvk := schema.GroupVersionKind{
			Group: resource.Group,
			Kind:  resource.Kind,
			// Version is left empty so ForKind will use the preferred version
		}
		resultBuilder := jobs.NewGVKResult(resource.Name, gvk).WithAction(repository.FileActionRenamed)

		progress.SetMessage(ctx, fmt.Sprintf("Finding path for resource %s/%s/%s", resource.Group, resource.Kind, resource.Name))
		resourcePath, err := repositoryResources.FindResourcePath(ctx, resource.Name, gvk)
		if err != nil {
			resultBuilder.WithError(fmt.Errorf("find path for resource %s/%s/%s: %w", resource.Group, resource.Kind, resource.Name, err))
			progress.Record(ctx, resultBuilder.Build())
			// Continue with next resource instead of failing fast
			if err := progress.TooManyErrors(); err != nil {
				return resolvedPaths, err
			}
			continue
		}

		resolvedPaths = append(resolvedPaths, resourcePath)
	}

	return resolvedPaths, nil
}

// deduplicatePaths removes duplicate file paths from the slice while preserving order
func deduplicatePaths(paths []string) []string {
	if len(paths) <= 1 {
		return paths
	}

	seen := make(map[string]struct{}, len(paths))
	result := make([]string, 0, len(paths))

	for _, path := range paths {
		if _, exists := seen[path]; !exists {
			seen[path] = struct{}{}
			result = append(result, path)
		}
	}

	return result
}
