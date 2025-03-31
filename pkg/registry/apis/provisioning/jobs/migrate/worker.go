package migrate

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/export"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	gogit "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/go-git"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"
)

type MigrationWorker struct {
	// Tempdir for repo clones
	clonedir string

	// temporary... while we still do an import
	parsers *resources.ParserFactory

	// Check where values are currently saved
	storageStatus dualwrite.Service

	// Support reading from history
	legacyMigrator legacy.LegacyMigrator

	// Direct access to unified storage... use carefully!
	bulk resource.BulkStoreClient

	// Decrypt secret from config object
	secrets secrets.Service

	// Delegate the export to the export worker
	exportWorker *export.ExportWorker

	// Delegate the import to sync worker
	syncWorker *sync.SyncWorker
}

func NewMigrationWorker(
	legacyMigrator legacy.LegacyMigrator,
	parsers *resources.ParserFactory, // should not be necessary!
	storageStatus dualwrite.Service,
	batch resource.BulkStoreClient,
	secrets secrets.Service,
	exportWorker *export.ExportWorker,
	syncWorker *sync.SyncWorker,
	clonedir string,
) *MigrationWorker {
	return &MigrationWorker{
		clonedir,
		parsers,
		storageStatus,
		legacyMigrator,
		batch,
		secrets,
		exportWorker,
		syncWorker,
	}
}

func (w *MigrationWorker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionMigrate
}

// Process will start a job
func (w *MigrationWorker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	options := job.Spec.Migrate
	if options == nil {
		return errors.New("missing migrate settings")
	}

	var (
		err      error
		buffered *gogit.GoGitRepo
	)

	isFromLegacy := dualwrite.IsReadingLegacyDashboardsAndFolders(ctx, w.storageStatus)
	progress.SetTotal(ctx, 10) // will show a progress bar

	// TODO: we should fail fast if migration is not possible and not always clone the repository.
	if repo.Config().Spec.GitHub != nil {
		progress.SetMessage(ctx, "clone "+repo.Config().Spec.GitHub.URL)
		reader, writer := io.Pipe()
		go func() {
			scanner := bufio.NewScanner(reader)
			for scanner.Scan() {
				progress.SetMessage(ctx, scanner.Text())
			}
		}()

		buffered, err = gogit.Clone(ctx, repo.Config(), gogit.GoGitCloneOptions{
			Root:                   w.clonedir,
			SingleCommitBeforePush: !(options.History && isFromLegacy),
			// TODO: make this configurable
			Timeout: 10 * time.Minute,
		}, w.secrets, writer)
		if err != nil {
			return fmt.Errorf("unable to clone target: %w", err)
		}

		repo = buffered // send all writes to the buffered repo
		defer func() {
			if err := buffered.Remove(ctx); err != nil {
				logging.FromContext(ctx).Error("failed to remove cloned repository after migrate", "err", err)
			}
		}()
	}

	rw, ok := repo.(repository.ReaderWriter)
	if !ok {
		return errors.New("migration job submitted targeting repository that is not a ReaderWriter")
	}

	if isFromLegacy {
		return w.migrateFromLegacy(ctx, rw, buffered, *options, progress)
	}

	return w.migrateFromAPIServer(ctx, rw, *options, progress)
}

// migrateFromLegacy will export the resources from legacy storage and import them into the target repository
func (w *MigrationWorker) migrateFromLegacy(ctx context.Context, rw repository.ReaderWriter, buffered *gogit.GoGitRepo, options provisioning.MigrateJobOptions, progress jobs.JobProgressRecorder) error {
	parser, err := w.parsers.GetParser(ctx, rw)
	if err != nil {
		return fmt.Errorf("error getting parser: %w", err)
	}

	var userInfo map[string]repository.CommitSignature
	if options.History {
		progress.SetMessage(ctx, "loading users")
		userInfo, err = loadUsers(ctx, parser)
		if err != nil {
			return fmt.Errorf("error loading users: %w", err)
		}
	}
	namespace := rw.Config().Namespace

	progress.SetMessage(ctx, "loading legacy folders")
	reader := NewLegacyFolderReader(w.legacyMigrator, rw.Config().Name, namespace)
	if err = reader.Read(ctx, w.legacyMigrator, rw.Config().Name, namespace); err != nil {
		return fmt.Errorf("error loading folder tree: %w", err)
	}

	folderClient, err := parser.Clients().Folder()
	if err != nil {
		return fmt.Errorf("error getting folder client: %w", err)
	}

	folders := resources.NewFolderManager(rw, folderClient, reader.Tree())
	progress.SetMessage(ctx, "exporting legacy folders")
	err = folders.EnsureTreeExists(ctx, "", "", func(folder resources.Folder, created bool, err error) error {
		result := jobs.JobResourceResult{
			Action:   repository.FileActionCreated,
			Name:     folder.ID,
			Resource: resources.FolderResource.Resource,
			Group:    resources.FolderResource.Group,
			Path:     folder.Path,
			Error:    err,
		}

		if !created {
			result.Action = repository.FileActionIgnored
		}

		progress.Record(ctx, result)
		return nil
	})
	if err != nil {
		return fmt.Errorf("error exporting legacy folders: %w", err)
	}

	progress.SetMessage(ctx, "exporting legacy resources")
	resourceManager := resources.NewResourcesManager(rw, folders, parser, parser.Clients(), userInfo)
	for _, kind := range resources.SupportedResources {
		if kind == resources.FolderResource {
			continue
		}

		reader := NewLegacyResourceMigrator(w.legacyMigrator, parser, resourceManager, progress, options, namespace, kind.GroupResource())
		if err := reader.Migrate(ctx); err != nil {
			return fmt.Errorf("error migrating resource %s: %w", kind, err)
		}
	}

	if buffered != nil {
		progress.SetMessage(ctx, "pushing changes")
		reader, writer := io.Pipe()
		go func() {
			scanner := bufio.NewScanner(reader)
			for scanner.Scan() {
				progress.SetMessage(ctx, scanner.Text())
			}
		}()

		if err := buffered.Push(ctx, gogit.GoGitPushOptions{
			// TODO: make this configurable
			Timeout: 10 * time.Minute,
		}, writer); err != nil {
			return fmt.Errorf("error pushing changes: %w", err)
		}
	}

	progress.SetMessage(ctx, "resetting unified storage")
	if err = wipeUnifiedAndSetMigratedFlag(ctx, w.storageStatus, namespace, w.bulk); err != nil {
		return fmt.Errorf("unable to reset unified storage %w", err)
	}

	// Reset the results after the export as pull will operate on the same resources
	progress.ResetResults()

	// Delegate the import to a sync (from the already checked out go-git repository!)
	progress.SetMessage(ctx, "pulling resources")
	err = w.syncWorker.Process(ctx, rw, provisioning.Job{
		Spec: provisioning.JobSpec{
			Pull: &provisioning.SyncJobOptions{
				Incremental: false,
			},
		},
	}, progress)
	if err != nil { // this will have an error when too many errors exist
		progress.SetMessage(ctx, "error importing resources, reverting")
		if e2 := stopReadingUnifiedStorage(ctx, w.storageStatus); e2 != nil {
			logger := logging.FromContext(ctx)
			logger.Warn("error trying to revert dual write settings after an error", "err", err)
		}
	}

	return err
}

// migrateFromAPIServer will export the resources from unified storage and import them into the target repository
func (w *MigrationWorker) migrateFromAPIServer(ctx context.Context, repo repository.ReaderWriter, options provisioning.MigrateJobOptions, progress jobs.JobProgressRecorder) error {
	progress.SetMessage(ctx, "exporting unified storage resources")
	exportJob := provisioning.Job{
		Spec: provisioning.JobSpec{
			Push: &provisioning.ExportJobOptions{
				Identifier: options.Identifier,
			},
		},
	}
	if err := w.exportWorker.Process(ctx, repo, exportJob, progress); err != nil {
		return fmt.Errorf("export resources: %w", err)
	}

	// Reset the results after the export as pull will operate on the same resources
	progress.ResetResults()
	progress.SetMessage(ctx, "pulling resources")
	syncJob := provisioning.Job{
		Spec: provisioning.JobSpec{
			Pull: &provisioning.SyncJobOptions{
				Incremental: false,
			},
		},
	}

	if err := w.syncWorker.Process(ctx, repo, syncJob, progress); err != nil {
		return fmt.Errorf("pull resources: %w", err)
	}

	progress.SetMessage(ctx, "removing unprovisioned resources")
	parser, err := w.parsers.GetParser(ctx, repo)
	if err != nil {
		return fmt.Errorf("error getting parser: %w", err)
	}

	return parser.Clients().ForEachUnmanagedResource(ctx, func(client dynamic.ResourceInterface, item *unstructured.Unstructured) error {
		result := jobs.JobResourceResult{
			Name:     item.GetName(),
			Resource: item.GetKind(),
			Group:    item.GroupVersionKind().Group,
			Action:   repository.FileActionDeleted,
		}

		if err = client.Delete(ctx, item.GetName(), metav1.DeleteOptions{}); err != nil {
			result.Error = fmt.Errorf("failed to delete folder: %w", err)
			progress.Record(ctx, result)
			return result.Error
		}

		progress.Record(ctx, result)

		return nil
	})
}
