package migrate

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs/sync"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	gogit "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/go-git"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type MigrationWorker struct {
	// Tempdir for repo clones
	clonedir string

	// Read users
	clients *resources.ClientFactory

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

	// Delegate the import to sync worker
	syncWorker *sync.SyncWorker
}

func NewMigrationWorker(clients *resources.ClientFactory,
	legacyMigrator legacy.LegacyMigrator,
	parsers *resources.ParserFactory, // should not be necessary!
	storageStatus dualwrite.Service,
	batch resource.BulkStoreClient,
	secrets secrets.Service,
	syncWorker *sync.SyncWorker,
	clonedir string,
) *MigrationWorker {
	return &MigrationWorker{
		clonedir,
		clients,
		parsers,
		storageStatus,
		legacyMigrator,
		batch,
		secrets,
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

	if !dualwrite.IsReadingLegacyDashboardsAndFolders(ctx, w.storageStatus) {
		return errors.New("already reading from unified storage")
	}

	var (
		err      error
		buffered *gogit.GoGitRepo
	)

	progress.SetTotal(10) // will show a progress bar
	if repo.Config().Spec.GitHub != nil {
		progress.SetMessage("clone " + repo.Config().Spec.GitHub.URL)
		reader, writer := io.Pipe()
		go func() {
			scanner := bufio.NewScanner(reader)
			for scanner.Scan() {
				progress.SetMessage(scanner.Text())
			}
		}()

		buffered, err = gogit.Clone(ctx, repo.Config(), gogit.GoGitCloneOptions{
			Root:                   w.clonedir,
			SingleCommitBeforePush: !options.History,
		}, w.secrets, writer)
		if err != nil {
			return fmt.Errorf("unable to clone target: %w", err)
		}
		repo = buffered // send all writes to the buffered repo
	}

	rw, ok := repo.(repository.ReaderWriter)
	if !ok {
		return errors.New("migration job submitted targeting repository that is not a ReaderWriter")
	}

	tree, err := rw.ReadTree(ctx, "")
	if err != nil {
		return fmt.Errorf("unable to read current tree: %w", err)
	}

	if true { // configurable?
		for _, v := range tree {
			if v.Blob && !resources.ShouldIgnorePath(v.Path) {
				err = rw.Delete(ctx, v.Path, "", "initial cleanup")
				if err != nil {
					return fmt.Errorf("initial cleanup error: %w", err)
				}
			}
		}
	}

	dynamicClient, _, err := w.clients.New(repo.Config().Namespace)
	if err != nil {
		return fmt.Errorf("error getting client: %w", err)
	}

	parser, err := w.parsers.GetParser(ctx, rw)
	if err != nil {
		return fmt.Errorf("error getting parser: %w", err)
	}

	worker, err := newMigrationJob(ctx, rw, *options, dynamicClient, parser, w.bulk, w.legacyMigrator, progress)
	if err != nil {
		return fmt.Errorf("error creating job: %w", err)
	}

	if options.History {
		progress.SetMessage("loading users")
		err = worker.loadUsers(ctx)
		if err != nil {
			return fmt.Errorf("error loading users: %w", err)
		}
	}

	// Load and write all folders
	progress.SetMessage("exporting folders")
	err = worker.loadFolders(ctx)
	if err != nil {
		return err
	}

	progress.SetMessage("exporting resources")
	err = worker.loadResources(ctx)
	if err != nil {
		return err
	}

	if buffered != nil {
		progress.SetMessage("pushing changes")
		reader, writer := io.Pipe()
		go func() {
			scanner := bufio.NewScanner(reader)
			for scanner.Scan() {
				progress.SetMessage(scanner.Text())
			}
		}()

		if err := buffered.Push(ctx, writer); err != nil {
			return fmt.Errorf("error pushing changes: %w", err)
		}
	}

	// Clear unified and allow writing
	err = worker.wipeUnifiedAndSetMigratedFlag(ctx, w.storageStatus)
	if err != nil {
		return fmt.Errorf("unable to reset unified storage %w", err)
	}

	// enable sync (won't be saved)
	rw.Config().Spec.Sync.Enabled = true

	// Delegate the import to a sync (from the already checked out go-git repository!)
	err = w.syncWorker.Process(ctx, rw, provisioning.Job{
		Spec: provisioning.JobSpec{
			Sync: &provisioning.SyncJobOptions{
				Incremental: false,
			},
		},
	}, progress)
	if err != nil { // this will have an error when too many errors exist
		e2 := stopReadingUnifiedStorage(ctx, w.storageStatus)
		if e2 != nil {
			logger := logging.FromContext(ctx)
			logger.Warn("error trying to revert dual write settings after an error", "err", err)
		}
	}
	return err
}

// MigrationJob holds all context for a running job
type migrationJob struct {
	logger logging.Logger
	target repository.ReaderWriter
	legacy legacy.LegacyMigrator
	client *resources.DynamicClient // used to read users
	parser *resources.Parser
	batch  resource.BulkStoreClient

	namespace string

	progress jobs.JobProgressRecorder

	userInfo   map[string]repository.CommitSignature
	folderTree *resources.FolderTree

	options provisioning.MigrateJobOptions
}

func newMigrationJob(ctx context.Context,
	target repository.ReaderWriter,
	options provisioning.MigrateJobOptions,
	client *resources.DynamicClient,
	parser *resources.Parser,
	batch resource.BulkStoreClient,
	legacyMigrator legacy.LegacyMigrator,
	progress jobs.JobProgressRecorder,
) (*migrationJob, error) {
	if options.Prefix != "" {
		options.Prefix = safepath.Clean(options.Prefix)
	}

	return &migrationJob{
		namespace:  target.Config().Namespace,
		target:     target,
		logger:     logging.FromContext(ctx),
		progress:   progress,
		options:    options,
		client:     client,
		parser:     parser,
		batch:      batch,
		legacy:     legacyMigrator,
		folderTree: resources.NewEmptyFolderTree(),
	}, nil
}

func (j *migrationJob) withAuthorSignature(ctx context.Context, item utils.GrafanaMetaAccessor) context.Context {
	if j.userInfo == nil {
		return ctx
	}
	id := item.GetUpdatedBy()
	if id == "" {
		id = item.GetCreatedBy()
	}
	if id == "" {
		id = "grafana"
	}

	sig := j.userInfo[id] // lookup
	if sig.Name == "" && sig.Email == "" {
		sig.Name = id
	}
	t, err := item.GetUpdatedTimestamp()
	if err == nil && t != nil {
		sig.When = *t
	} else {
		sig.When = item.GetCreationTimestamp().Time
	}

	return repository.WithAuthorSignature(ctx, sig)
}
