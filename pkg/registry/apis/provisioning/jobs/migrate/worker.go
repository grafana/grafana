package migrate

import (
	"context"
	"errors"
	"fmt"
	"os"

	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboard "github.com/grafana/grafana/pkg/apis/dashboard"
	folders "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
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

	// Check where values are currently saved
	storageStatus dualwrite.Service

	// Support reading from history
	legacyMigrator legacy.LegacyMigrator

	// Direct access to unified storage... use carefully!
	batch resource.BatchStoreClient

	// Decrypt secret from config object
	secrets secrets.Service
}

func NewMigrationWorker(clients *resources.ClientFactory,
	legacyMigrator legacy.LegacyMigrator,
	storageStatus dualwrite.Service,
	batch resource.BatchStoreClient,
	secrets secrets.Service,
	clonedir string,
) *MigrationWorker {
	return &MigrationWorker{
		clonedir,
		clients,
		storageStatus,
		legacyMigrator,
		batch,
		secrets,
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

	if repo.Config().Spec.GitHub != nil {
		progress.SetMessage("clone target")
		buffered, err = gogit.Clone(ctx, repo.Config(), gogit.GoGitCloneOptions{
			Root:                   w.clonedir,
			SingleCommitBeforePush: !options.History,
		}, w.secrets, os.Stdout)
		if err != nil {
			return fmt.Errorf("unable to clone target: %w", err)
		}
		repo = buffered // send all writes to the buffered repo
	}

	tree, err := repo.ReadTree(ctx, "")
	if err != nil {
		return fmt.Errorf("unable to read currnet tree: %w", err)
	}
	if isEmptyRepo(tree) {
		return fmt.Errorf("expecting empty repository target")
	}

	dynamicClient, _, err := w.clients.New(repo.Config().Namespace)
	if err != nil {
		return fmt.Errorf("error getting client: %w", err)
	}

	worker, err := newMigrationJob(ctx, repo, *options, dynamicClient, w.legacyMigrator, w.batch, progress)
	if err != nil {
		return fmt.Errorf("error creating job: %w", err)
	}

	// Make sure we close
	defer func() {
		if worker.batch != nil {
			_ = worker.batch.CloseSend()
		}
	}()

	if options.History {
		progress.SetMessage("load users")
		err = worker.loadUsers(ctx)
		if err != nil {
			return fmt.Errorf("error loading users: %w", err)
		}
	}

	// Load and write all folders
	progress.SetMessage("start folder export")
	err = worker.loadFolders(ctx)
	if err != nil {
		return err
	}

	progress.SetMessage("start resource export")
	err = worker.loadResources(ctx)
	if err != nil {
		return err
	}

	if buffered != nil {
		progress.SetMessage("push changes")
		if err := buffered.Push(ctx, os.Stdout); err != nil {
			return fmt.Errorf("error pushing changes: %w", err)
		}
	}

	rsp, err := worker.batch.CloseAndRecv()
	if err != nil {
		return fmt.Errorf("error getting results: %w", err)
	}
	worker.logger.Info("processed", "results", rsp)

	return nil
}

// MigrationJob holds all context for a running job
type migrationJob struct {
	logger logging.Logger
	target repository.Repository
	legacy legacy.LegacyMigrator
	batch  resource.BatchStore_BatchProcessClient
	client *resources.DynamicClient // Read from

	namespace string

	progress jobs.JobProgressRecorder

	userInfo   map[string]repository.CommitSignature
	folderTree *resources.FolderTree

	options provisioning.MigrateJobOptions
}

func newMigrationJob(ctx context.Context,
	target repository.Repository,
	options provisioning.MigrateJobOptions,
	client *resources.DynamicClient,
	legacyMigrator legacy.LegacyMigrator,
	batch resource.BatchStoreClient,
	progress jobs.JobProgressRecorder,
) (*migrationJob, error) {
	if options.Prefix != "" {
		options.Prefix = safepath.Clean(options.Prefix)
	}

	ns := target.Config().Namespace
	settings := resource.BatchSettings{
		RebuildCollection: true, // wipes everything in the collection
		Collection: []*resource.ResourceKey{{
			Namespace: ns,
			Group:     folders.GROUP,
			Resource:  folders.RESOURCE,
		}, {
			Namespace: ns,
			Group:     dashboard.GROUP,
			Resource:  dashboard.DASHBOARD_RESOURCE,
		}},
	}
	ctx = metadata.NewOutgoingContext(ctx, settings.ToMD())
	stream, err := batch.BatchProcess(ctx)
	if err != nil {
		return nil, err
	}

	return &migrationJob{
		namespace:  target.Config().Namespace,
		target:     target,
		logger:     logging.FromContext(ctx),
		progress:   progress,
		options:    options,
		client:     client,
		legacy:     legacyMigrator,
		batch:      stream,
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
