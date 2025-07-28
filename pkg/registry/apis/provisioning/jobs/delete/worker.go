package delete

import (
	"context"
	"errors"
	"fmt"
	"time"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
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
	return job.Spec.Action == provisioning.JobActionDelete
}

func (w *Worker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	if job.Spec.Delete == nil {
		return errors.New("missing delete settings")
	}
	opts := *job.Spec.Delete

	paths := opts.Paths
	progress.SetTotal(ctx, len(paths))
	progress.StrictMaxErrors(1) // Fail fast on any error during deletion

	fn := func(repo repository.Repository, _ bool) error {
		rw, ok := repo.(repository.ReaderWriter)
		if !ok {
			return errors.New("delete job submitted targeting repository that is not a ReaderWriter")
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
