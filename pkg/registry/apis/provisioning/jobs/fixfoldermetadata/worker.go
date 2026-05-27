package fixfoldermetadata

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/util"
)

const keepFileName = ".keep"

// Worker implements the fix-folder-metadata job type.
// It scans the repository tree and writes a _folder.json metadata file for
// every directory that does not already have one, using a hash-derived UID.
// It also removes legacy .keep files from folders that have (or receive)
// a _folder.json, since the metadata file supersedes the keep marker.
type Worker struct {
	folderGVK schema.GroupVersionKind
}

func NewWorker(folderGVK schema.GroupVersionKind) *Worker {
	return &Worker{folderGVK: folderGVK}
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

		entries, err := rw.ReadTree(ctx, ref)
		if err != nil {
			return fmt.Errorf("read repository tree: %w", err)
		}

		repoName := rw.Config().GetName()

		// Collect dirs with existing metadata, track .keep files, and parse all folder entries.
		hasMetadata := make(map[string]struct{}, len(entries))
		hasKeepFile := make(map[string]string, len(entries))
		folders := make([]resources.Folder, 0, len(entries))
		for _, entry := range entries {
			if entry.Blob {
				if resources.IsFolderMetadataFile(entry.Path) {
					hasMetadata[safepath.Dir(entry.Path)] = struct{}{}
				} else if isKeepFile(entry.Path) {
					hasKeepFile[safepath.Dir(entry.Path)] = entry.Path
				}
				continue
			}
			dirPath := entry.Path
			if !safepath.IsDir(dirPath) {
				dirPath += "/"
			}
			folders = append(folders, resources.ParseFolder(dirPath, repoName))
		}

		totalMissing := len(folders) - len(hasMetadata)
		progress.SetTotal(ctx, totalMissing)

		for _, folder := range folders {
			if _, ok := hasMetadata[folder.Path]; ok {
				// Folder already has _folder.json; remove stale .keep if present.
				if keepPath, ok := hasKeepFile[folder.Path]; ok {
					deleteKeepFile(ctx, rw, keepPath, ref, logger)
				}
				continue
			}

			manifest := resources.NewFolderManifest(util.GenerateShortUID(), safepath.Base(folder.Path), w.folderGVK)
			_, writeErr := resources.WriteFolderMetadata(ctx, rw, folder.Path, manifest, ref,
				fmt.Sprintf("Add folder metadata for %s", folder.Path))

			rb := jobs.NewFolderResult(folder.Path).
				WithName(folder.ID).
				WithAction(repository.FileActionCreated)
			if writeErr != nil {
				wrappedErr := fmt.Errorf("writing folder metadata for %s: %w", folder.Path, writeErr)
				rb.WithError(wrappedErr)
				progress.Record(ctx, rb.Build())
				return wrappedErr
			}

			// _folder.json now exists; remove the legacy .keep if present.
			if keepPath, ok := hasKeepFile[folder.Path]; ok {
				deleteKeepFile(ctx, rw, keepPath, ref, logger)
			}

			progress.Record(ctx, rb.Build())
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

func isKeepFile(path string) bool {
	return strings.HasSuffix(path, keepFileName)
}

// deleteKeepFile removes a .keep file, logging but not failing on errors
// (the .keep may already be absent in certain edge cases).
func deleteKeepFile(ctx context.Context, rw repository.ReaderWriter, keepPath, ref string, logger logging.Logger) {
	if err := rw.Delete(ctx, keepPath, ref, "Remove legacy .keep replaced by _folder.json"); err != nil {
		if errors.Is(err, repository.ErrFileNotFound) {
			return
		}
		logger.Warn("failed to delete .keep file", "path", keepPath, "error", err)
	}
}
