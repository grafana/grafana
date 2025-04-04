package migrate

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type MigrationWorker struct {
	// temporary... while we still do an import
	parsers resources.ParserFactory

	clients resources.ClientFactory

	// Check where values are currently saved
	storageStatus dualwrite.Service

	// Support reading from history
	legacyMigrator legacy.LegacyMigrator

	// Direct access to unified storage... use carefully!
	bulk resource.BulkStoreClient

	// Delegate the export to the export worker
	exportWorker jobs.Worker

	// Delegate the import to sync worker
	syncWorker jobs.Worker
}

func NewMigrationWorker(
	legacyMigrator legacy.LegacyMigrator,
	parsers resources.ParserFactory, // should not be necessary!
	clients resources.ClientFactory,
	storageStatus dualwrite.Service,
	batch resource.BulkStoreClient,
	exportWorker jobs.Worker,
	syncWorker jobs.Worker,
) *MigrationWorker {
	return &MigrationWorker{
		parsers,
		clients,
		storageStatus,
		legacyMigrator,
		batch,
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

	progress.SetTotal(ctx, 10) // will show a progress bar
	rw, ok := repo.(repository.ReaderWriter)
	if !ok {
		return errors.New("migration job submitted targeting repository that is not a ReaderWriter")
	}
	parser, err := w.parsers.GetParser(ctx, rw)
	if err != nil {
		return fmt.Errorf("error getting parser: %w", err)
	}

	clients, err := w.clients.Clients(ctx, rw.Config().Namespace)
	if err != nil {
		return fmt.Errorf("error getting clients: %w", err)
	}

	if dualwrite.IsReadingLegacyDashboardsAndFolders(ctx, w.storageStatus) {
		return w.migrateFromLegacy(ctx, rw, parser, clients, *options, progress)
	}

	return w.migrateFromAPIServer(ctx, rw, clients, *options, progress)
}

// migrateFromLegacy will export the resources from legacy storage and import them into the target repository
func (w *MigrationWorker) migrateFromLegacy(ctx context.Context, rw repository.ReaderWriter, parser resources.Parser, clients resources.ResourceClients, options provisioning.MigrateJobOptions, progress jobs.JobProgressRecorder) error {
	var (
		err   error
		clone repository.ClonedRepository
	)

	clonable, ok := rw.(repository.ClonableRepository)
	if ok {
		progress.SetMessage(ctx, "clone "+rw.Config().Spec.GitHub.URL)
		reader, writer := io.Pipe()
		go func() {
			scanner := bufio.NewScanner(reader)
			for scanner.Scan() {
				progress.SetMessage(ctx, scanner.Text())
			}
		}()

		clone, err = clonable.Clone(ctx, repository.CloneOptions{
			PushOnWrites: options.History,
			// TODO: make this configurable
			Timeout:  10 * time.Minute,
			Progress: writer,
		})
		if err != nil {
			return fmt.Errorf("unable to clone target: %w", err)
		}

		rw = clone // send all writes to the buffered repo
		defer func() {
			if err := clone.Remove(ctx); err != nil {
				logging.FromContext(ctx).Error("failed to remove cloned repository after migrate", "err", err)
			}
		}()
	}

	var userInfo map[string]repository.CommitSignature
	if options.History {
		progress.SetMessage(ctx, "loading users")
		userInfo, err = loadUsers(ctx, clients)
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

	folderClient, err := clients.Folder()
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
	resourceManager := resources.NewResourcesManager(rw, folders, parser, clients, userInfo)
	for _, kind := range resources.SupportedProvisioningResources {
		if kind == resources.FolderResource {
			continue
		}

		reader := NewLegacyResourceMigrator(w.legacyMigrator, parser, resourceManager, progress, options, namespace, kind.GroupResource())
		if err := reader.Migrate(ctx); err != nil {
			return fmt.Errorf("error migrating resource %s: %w", kind, err)
		}
	}

	if clone != nil {
		progress.SetMessage(ctx, "pushing changes")
		reader, writer := io.Pipe()
		go func() {
			scanner := bufio.NewScanner(reader)
			for scanner.Scan() {
				progress.SetMessage(ctx, scanner.Text())
			}
		}()

		if err := clone.Push(ctx, repository.PushOptions{
			// TODO: make this configurable
			Timeout:  10 * time.Minute,
			Progress: writer,
		}); err != nil {
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
func (w *MigrationWorker) migrateFromAPIServer(ctx context.Context, repo repository.ReaderWriter, clients resources.ResourceClients, options provisioning.MigrateJobOptions, progress jobs.JobProgressRecorder) error {
	progress.SetMessage(ctx, "exporting unified storage resources")
	exportJob := provisioning.Job{
		Spec: provisioning.JobSpec{
			Push: &provisioning.ExportJobOptions{},
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

	for _, kind := range resources.SupportedProvisioningResources {
		progress.SetMessage(ctx, fmt.Sprintf("removing unprovisioned %s", kind.Resource))
		client, _, err := clients.ForResource(kind)
		if err != nil {
			return err
		}
		if err = resources.ForEach(ctx, client, func(item *unstructured.Unstructured) error {
			result := jobs.JobResourceResult{
				Name:     item.GetName(),
				Resource: item.GetKind(),
				Group:    item.GroupVersionKind().Group,
				Action:   repository.FileActionDeleted,
			}

			if err := client.Delete(ctx, item.GetName(), metav1.DeleteOptions{}); err != nil {
				result.Error = fmt.Errorf("failed to delete folder: %w", err)
				progress.Record(ctx, result)
				return result.Error
			}

			progress.Record(ctx, result)
			return nil
		}); err != nil {
			return err
		}
	}
	return nil
}
