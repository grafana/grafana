package move

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"time"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

type Worker struct {
	syncWorker jobs.Worker
	wrapFn     repository.WrapWithStageFn
}

func NewWorker(syncWorker jobs.Worker, wrapFn repository.WrapWithStageFn) *Worker {
	return &Worker{
		syncWorker: syncWorker,
		wrapFn:     wrapFn,
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

	if opts.TargetPath == "" {
		return errors.New("target path is required for move operation")
	}

	// Validate that target path is a directory (ends with slash)
	if !safepath.IsDir(opts.TargetPath) {
		return errors.New("target path must be a directory (should end with '/')")
	}

	paths := opts.Paths
	progress.SetTotal(ctx, len(paths))
	progress.StrictMaxErrors(1) // Fail fast on any error during move

	fn := func(repo repository.Repository, _ bool) error {
		rw, ok := repo.(repository.ReaderWriter)
		if !ok {
			return errors.New("move job submitted targeting repository that is not a ReaderWriter")
		}

		return w.moveFiles(ctx, rw, progress, opts, paths...)
	}

	msg := fmt.Sprintf("Move files from Grafana %s", job.Name)
	stageOptions := repository.StageOptions{
		Mode:                  repository.StageModeCommitOnlyOnce,
		CommitOnlyOnceMessage: msg,
		PushOnWrites:          false,
		Timeout:               10 * time.Minute,
	}

	err := w.wrapFn(ctx, repo, stageOptions, fn)
	if err != nil {
		return fmt.Errorf("move files in repository: %w", err)
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

func (w *Worker) moveFiles(ctx context.Context, rw repository.ReaderWriter, progress jobs.JobProgressRecorder, opts provisioning.MoveJobOptions, paths ...string) error {
	for _, path := range paths {
		result := jobs.JobResourceResult{
			Path:   path,
			Action: repository.FileActionRenamed,
		}

		// Construct the target path by combining the job's target path with the file/folder name
		targetPath := w.constructTargetPath(opts.TargetPath, path)

		progress.SetMessage(ctx, "Moving "+path+" to "+targetPath)
		result.Error = rw.Move(ctx, path, targetPath, opts.Ref, "Move "+path+" to "+targetPath)
		progress.Record(ctx, result)
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
