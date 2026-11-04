package move

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/plan"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
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

func (w *Worker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) (processErr error) {
	if job.Spec.Move == nil {
		return errors.New("missing move settings")
	}
	opts := *job.Spec.Move
	logger := logging.FromContext(ctx).With("options", job.Spec.Move)
	ctx = logging.Context(ctx, logger)
	ctx, span := tracing.Start(ctx, "provisioning.move.process")
	defer func() {
		if processErr != nil {
			_ = tracing.Error(span, processErr)
		}
		span.End()
	}()
	span.SetAttributes(
		attribute.String("move.ref", opts.Ref),
		attribute.String("move.target_path", opts.TargetPath),
		attribute.Int("move.paths_count", len(opts.Paths)),
		attribute.Int("move.resources_count", len(opts.Resources)),
	)

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
		CommitOnlyOnceMessage: jobs.CommitMessage(job, msg),
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

	// Finalize the progress recorder. The job metric is recorded by the driver from
	// the job's final status, so the returned status is not needed here.
	progress.Complete(ctx, nil)

	return nil
}

func (w *Worker) moveFiles(ctx context.Context, rw repository.ReaderWriter, progress jobs.JobProgressRecorder, opts provisioning.MoveJobOptions, paths ...string) error {
	for _, path := range paths {
		resultBuilder := jobs.NewPathOnlyResult(path).WithAction(repository.FileActionRenamed)
		// Construct the target path by combining the job's target path with the file/folder name
		targetPath := w.constructTargetPath(opts.TargetPath, path)

		if path == targetPath {
			progress.SetMessage(ctx, "Skipping "+path+" because it is already in "+opts.TargetPath)
			progress.Record(ctx, jobs.NewPathOnlyResult(path).WithAction(repository.FileActionIgnored).Build())
			if err := progress.TooManyErrors(); err != nil {
				return err
			}
			continue
		}

		// The target path is constructed from a job-supplied directory and is
		// otherwise unchecked, so a move can land a resource where Grafana
		// cannot address it — the write succeeds in the repository and the
		// next sync deletes it. The same classifier the sync and the files API
		// use decides it here.
		//
		// For a directory the whole subtree has to be classified, not just the
		// destination folder: a tree move takes everything inside it along, so
		// a resource can pass the depth limit where it is and fail where it
		// lands.
		refused, err := w.refuseMove(ctx, rw, path, targetPath, opts.Ref)
		if err != nil {
			return err // transient: not a refusal
		}
		if len(refused) > 0 {
			progress.Record(ctx, resultBuilder.
				WithError(&resources.UnsupportedPathError{
					Path: refused[0].Path,
					Err:  resources.IsPathSupported(refused[0].Path),
				}).
				Build())
			if err := progress.TooManyErrors(); err != nil {
				return err
			}
			continue
		}

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

// refuseMove classifies a move's destination, and for a directory every
// destination its contents would land at.
func (w *Worker) refuseMove(ctx context.Context, rw repository.ReaderWriter, sourcePath, targetPath, ref string) ([]plan.PathRefusal, error) {
	if !safepath.IsDir(sourcePath) {
		return plan.RefuseUnsupportedPaths(targetPath), nil
	}

	tree, err := rw.ReadTree(ctx, ref)
	if err != nil {
		return nil, fmt.Errorf("read tree to classify a directory move: %w", err)
	}
	// Directories count as contents. A folder holding nothing a resource
	// classifier looks at — a .keep, a README — still becomes a Grafana folder,
	// so a move that pushes it past the depth limit leaves the repository
	// holding a folder the next sync excludes.
	var contents []string
	for _, entry := range tree {
		if !safepath.InDir(entry.Path, sourcePath) {
			continue
		}
		if entry.Blob {
			contents = append(contents, entry.Path)
			continue
		}
		contents = append(contents, safepath.EnsureTrailingSlash(entry.Path))
	}
	return plan.RefuseUnsupportedMove(sourcePath, targetPath, contents), nil
}

// constructTargetPath combines the job's target path with the file/folder name from the source path.
// safepath.Clean normalises the target directory ("/" and "." become "", trailing slashes are stripped),
// and safepath.Join produces a correct relative repository path.
func (w *Worker) constructTargetPath(jobTargetPath, sourcePath string) string {
	fileName := safepath.Base(sourcePath)
	targetDir := safepath.Clean(jobTargetPath)

	if safepath.IsDir(sourcePath) {
		return safepath.Join(targetDir, fileName) + "/"
	}

	return safepath.Join(targetDir, fileName)
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
