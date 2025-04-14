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
)

//go:generate mockery --name WrapWithCloneFn --structname MockWrapWithCloneFn --inpackage --filename mock_wrap_with_clone_fn.go --with-expecter
type WrapWithCloneFn func(ctx context.Context, repo repository.Repository, cloneOptions repository.CloneOptions, pushOptions repository.PushOptions, fn func(repo repository.Repository, cloned bool) error) error

type MigrationWorker struct {
	// temporary... while we still do an import
	parsers resources.ParserFactory

	clients resources.ClientFactory

	repositoryResources resources.RepositoryResourcesFactory

	storageSwapper *StorageSwapper

	// Support reading from history
	legacyMigrator legacy.LegacyMigrator

	// Delegate the export to the export worker
	exportWorker jobs.Worker

	// Delegate the import to sync worker
	syncWorker jobs.Worker

	wrapWithCloneFn WrapWithCloneFn
}

func NewMigrationWorker(
	legacyMigrator legacy.LegacyMigrator,
	parsers resources.ParserFactory, // should not be necessary!
	clients resources.ClientFactory,
	repositoryResources resources.RepositoryResourcesFactory,
	storageSwapper *StorageSwapper,
	exportWorker jobs.Worker,
	syncWorker jobs.Worker,
	wrapWithCloneFn WrapWithCloneFn,
) *MigrationWorker {
	return &MigrationWorker{
		parsers:             parsers,
		clients:             clients,
		repositoryResources: repositoryResources,
		storageSwapper:      storageSwapper,
		legacyMigrator:      legacyMigrator,
		exportWorker:        exportWorker,
		syncWorker:          syncWorker,
		wrapWithCloneFn:     wrapWithCloneFn,
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

	if w.storageSwapper.IsReadingFromUnifiedStorage(ctx) {
		return w.migrateFromAPIServer(ctx, rw, clients, *options, progress)
	}

	return w.migrateFromLegacy(ctx, rw, parser, clients, *options, progress)
}

// migrateFromLegacy will export the resources from legacy storage and import them into the target repository
func (w *MigrationWorker) migrateFromLegacy(ctx context.Context, rw repository.ReaderWriter, parser resources.Parser, clients resources.ResourceClients, options provisioning.MigrateJobOptions, progress jobs.JobProgressRecorder) error {
	namespace := rw.Config().Namespace

	reader, writer := io.Pipe()
	go func() {
		scanner := bufio.NewScanner(reader)
		for scanner.Scan() {
			progress.SetMessage(ctx, scanner.Text())
		}
	}()

	cloneOptions := repository.CloneOptions{
		PushOnWrites: options.History,
		// TODO: make this configurable
		Timeout:  10 * time.Minute,
		Progress: writer,
		BeforeFn: func() error {
			progress.SetMessage(ctx, "clone repository")
			return nil
		},
	}
	pushOptions := repository.PushOptions{
		// TODO: make this configurable
		Timeout:  10 * time.Minute,
		Progress: writer,
		BeforeFn: func() error {
			progress.SetMessage(ctx, "push changes")
			return nil
		},
	}

	if err := w.wrapWithCloneFn(ctx, rw, cloneOptions, pushOptions, func(repo repository.Repository, cloned bool) error {
		rw, ok := repo.(repository.ReaderWriter)
		if !ok {
			return errors.New("migration job submitted targeting repository that is not a ReaderWriter")
		}

		opts := resources.RepositoryResourcesOptions{
			CommitWithOriginalAuthors: options.History,
		}

		repositoryResources, err := w.repositoryResources.Client(ctx, rw, opts)
		if err != nil {
			return fmt.Errorf("get repository resources: %w", err)
		}

		progress.SetMessage(ctx, "migrate folders from SQL")
		folderMigrator := NewLegacyFolderMigrator(w.legacyMigrator)
		if err = folderMigrator.Migrate(ctx, w.legacyMigrator, namespace, repositoryResources, progress); err != nil {
			return fmt.Errorf("migrate folders from SQL: %w", err)
		}

		progress.SetMessage(ctx, "exporting resources from SQL")
		for _, kind := range resources.SupportedProvisioningResources {
			if kind == resources.FolderResource {
				continue
			}

			reader := NewLegacyResourceMigrator(w.legacyMigrator, parser, repositoryResources, progress, options, namespace, kind.GroupResource())
			if err := reader.Migrate(ctx); err != nil {
				return fmt.Errorf("migrate resource %s: %w", kind, err)
			}
		}
		return nil
	}); err != nil {
		return fmt.Errorf("migrate from SQL: %w", err)
	}

	progress.SetMessage(ctx, "resetting unified storage")
	if err := w.storageSwapper.WipeUnifiedAndSetMigratedFlag(ctx, namespace); err != nil {
		return fmt.Errorf("unable to reset unified storage %w", err)
	}

	// Reset the results after the export as pull will operate on the same resources
	progress.ResetResults()

	// Delegate the import to a sync (from the already checked out go-git repository!)
	progress.SetMessage(ctx, "pulling resources")
	if err := w.syncWorker.Process(ctx, rw, provisioning.Job{
		Spec: provisioning.JobSpec{
			Pull: &provisioning.SyncJobOptions{
				Incremental: false,
			},
		},
	}, progress); err != nil { // this will have an error when too many errors exist
		progress.SetMessage(ctx, "error importing resources, reverting")
		if e2 := w.storageSwapper.StopReadingUnifiedStorage(ctx); e2 != nil {
			logger := logging.FromContext(ctx)
			logger.Warn("error trying to revert dual write settings after an error", "err", err)
		}
		return err
	}

	return nil
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
