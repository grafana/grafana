package fixfoldermetadata

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana-app-sdk/logging"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// Worker implements the fix-folder-metadata job type.
// It ensures every managed folder in the repository has a _folder.json metadata file.
type Worker struct {
	repositoryResources resources.RepositoryResourcesFactory
}

func NewWorker(repositoryResources resources.RepositoryResourcesFactory) *Worker {
	return &Worker{repositoryResources: repositoryResources}
}

func (w *Worker) IsSupported(_ context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionFixFolderMetadata
}

func (w *Worker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) (processErr error) {
	options := job.Spec.FixFolderMetadata
	if options == nil {
		options = &provisioning.FixFolderMetadataJobOptions{}
	}

	logger := logging.FromContext(ctx).With("options", options)
	ctx = logging.Context(ctx, logger)
	ctx, span := tracing.Start(ctx, "provisioning.fixfoldermetadata.process")
	defer func() {
		if processErr != nil {
			_ = tracing.Error(span, processErr)
		}
		span.End()
	}()
	span.SetAttributes(attribute.String("fixfoldermetadata.ref", options.Ref))

	ref := options.Ref
	logger.Info("starting folder metadata fix job")
	if ref == "" {
		progress.SetMessage(ctx, "Writing folder metadata files on default branch")
	} else {
		progress.SetMessage(ctx, fmt.Sprintf("Writing folder metadata files on branch %s", ref))
	}

	// Configure staging options to commit everything at once
	stageOptions := repository.StageOptions{
		Ref:                   ref,
		Timeout:               5 * time.Minute,
		PushOnWrites:          false,
		Mode:                  repository.StageModeCommitOnlyOnce,
		CommitOnlyOnceMessage: fmt.Sprintf("Add folder metadata files\n\nTriggered by job %s at %s", job.Name, time.Now().UTC().Format(time.RFC3339)),
	}

	fn := func(stagedRepo repository.Repository, staged bool) error {
		rw, ok := stagedRepo.(repository.ReaderWriter)
		if !ok {
			return fmt.Errorf("repository does not support read/write operations")
		}

		repoResources, err := w.repositoryResources.Client(ctx, rw)
		if err != nil {
			return fmt.Errorf("create repository resources client: %w", err)
		}

		list, err := repoResources.List(ctx)
		if err != nil {
			return fmt.Errorf("list managed resources: %w", err)
		}

		for _, rf := range list.Items {
			if rf.Group != folders.GROUP {
				continue
			}

			folder := resources.Folder{ID: rf.Name, Path: rf.Path, Title: rf.Title}
			written, ensureErr := repoResources.EnsureFolderMetadata(ctx, folder, ref)

			action := repository.FileActionIgnored
			if written {
				action = repository.FileActionCreated
			}

			resultBuilder := jobs.NewFolderResult(folder.Path).
				WithName(folder.ID).
				WithAction(action)
			if ensureErr != nil {
				resultBuilder.WithError(fmt.Errorf("writing folder metadata for %s: %w", folder.Path, ensureErr))
			}
			progress.Record(ctx, resultBuilder.Build())

			if err := progress.TooManyErrors(); err != nil {
				return err
			}
		}

		return nil
	}

	// Execute the staging operation
	if err := repository.WrapWithStageAndPushIfPossible(ctx, repo, stageOptions, fn); err != nil {
		logger.Error("failed to write folder metadata files", "error", err)
		progress.SetFinalMessage(ctx, fmt.Sprintf("Failed to fix folder metadata: %s", err.Error()))
		return err
	}

	// Set RefURLs if the repository supports it and a ref was used
	// For empty ref (default branch), we need to get the actual branch name that was used
	if repoWithURLs, ok := repo.(repository.RepositoryWithURLs); ok {
		// If ref is empty, try to get the default branch to use for URLs
		actualRef := ref
		if actualRef == "" {
			if branchHandler, ok := repo.(repository.BranchHandler); ok {
				if defaultBranch, err := branchHandler.GetDefaultBranch(ctx); err == nil {
					actualRef = defaultBranch
				}
			}
		}

		if actualRef != "" {
			if refURLs, urlErr := repoWithURLs.RefURLs(ctx, actualRef); urlErr == nil && refURLs != nil {
				progress.SetRefURLs(ctx, refURLs)
				logger.Info("set reference URLs", "ref", actualRef, "urls", refURLs)
			} else if urlErr != nil {
				logger.Warn("failed to get reference URLs", "ref", actualRef, "error", urlErr)
			}
		}
	}

	logger.Info("folder metadata fix job completed successfully")
	if ref == "" {
		progress.SetFinalMessage(ctx, "Folder metadata fixed on default branch")
	} else {
		progress.SetFinalMessage(ctx, fmt.Sprintf("Folder metadata fixed on branch %s", ref))
	}

	return nil
}
