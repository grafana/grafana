package fixfoldermetadata

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
)

// Worker implements the fix-folder-metadata job type.
// It creates a marker commit on the specified branch to document when folder metadata was fixed.
type Worker struct{}

func NewWorker() *Worker {
	return &Worker{}
}

func (w *Worker) IsSupported(_ context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionFixFolderMetadata
}

func (w *Worker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	logger := logging.FromContext(ctx).With("job", job.GetName(), "namespace", job.GetNamespace())

	// Get options, defaulting to empty if not provided
	options := job.Spec.FixFolderMetadata
	if options == nil {
		options = &provisioning.FixFolderMetadataJobOptions{}
	}

	// Default to "main" if no ref is specified
	ref := options.Ref
	if ref == "" {
		ref = "main"
	}

	logger.Info("starting folder metadata fix job", "ref", ref)
	progress.SetMessage(ctx, fmt.Sprintf("Creating marker commit on branch %s", ref))

	// Configure staging options to commit everything at once
	stageOptions := repository.StageOptions{
		Ref:                   ref,
		Timeout:               5 * time.Minute,
		PushOnWrites:          false,
		Mode:                  repository.StageModeCommitOnlyOnce,
		CommitOnlyOnceMessage: fmt.Sprintf("Fix folder metadata\n\nTriggered by job %s at %s", job.Name, time.Now().UTC().Format(time.RFC3339)),
	}

	// Create a marker file to document when the fix was run
	fn := func(stagedRepo repository.Repository, staged bool) error {
		// For non-stageable repositories (like local folders), just skip the commit
		// The job will complete successfully but won't create a marker file
		if !staged {
			logger.Info("repository does not support staging, skipping marker commit")
			return nil
		}

		rw, ok := stagedRepo.(repository.ReaderWriter)
		if !ok {
			return fmt.Errorf("staged repository does not support read/write operations")
		}

		// Write a marker file with timestamp
		markerPath := fmt.Sprintf(".grafana/folder-metadata-fixed-%d", time.Now().Unix())
		markerContent := []byte(fmt.Sprintf("Folder metadata fixed by job %s\nTimestamp: %s\nRef: %s\n",
			job.Name,
			time.Now().UTC().Format(time.RFC3339),
			ref,
		))

		// Write the marker file
		if err := rw.Write(ctx, markerPath, ref, markerContent, "Add folder metadata fix marker"); err != nil {
			return fmt.Errorf("failed to write marker file: %w", err)
		}

		logger.Info("marker file written", "path", markerPath)
		return nil
	}

	// Execute the staging operation
	if err := repository.WrapWithStageAndPushIfPossible(ctx, repo, stageOptions, fn); err != nil {
		logger.Error("failed to create marker commit", "error", err)
		progress.SetFinalMessage(ctx, fmt.Sprintf("Failed to fix folder metadata: %s", err.Error()))
		return err
	}

	// Set RefURLs if the repository supports it
	if repoWithURLs, ok := repo.(repository.RepositoryWithURLs); ok {
		if refURLs, urlErr := repoWithURLs.RefURLs(ctx, ref); urlErr == nil && refURLs != nil {
			progress.SetRefURLs(ctx, refURLs)
			logger.Info("set reference URLs", "urls", refURLs)
		} else if urlErr != nil {
			logger.Warn("failed to get reference URLs", "error", urlErr)
		}
	}

	logger.Info("folder metadata fix job completed successfully")
	progress.SetFinalMessage(ctx, fmt.Sprintf("Folder metadata fixed on branch %s", ref))

	return nil
}
