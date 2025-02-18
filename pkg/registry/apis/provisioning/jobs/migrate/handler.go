package migrate

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	gogit "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/go-git"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type MigrationHandler struct {
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
) *MigrationHandler {
	return &MigrationHandler{
		clonedir,
		clients,
		storageStatus,
		legacyMigrator,
		batch,
		secrets,
	}
}

func (h *MigrationHandler) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionMigrate
}

// Process will start a job
func (h *MigrationHandler) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	options := job.Spec.Migrate
	if options == nil {
		return errors.New("missing migrate settings")
	}

	if !dualwrite.IsReadingLegacyDashboardsAndFolders(ctx, h.storageStatus) {
		return errors.New("already reading from unified storage")
	}

	var (
		err      error
		buffered *gogit.GoGitRepo
	)

	if repo.Config().Spec.GitHub != nil {
		progress.SetMessage("clone target")
		buffered, err = gogit.Clone(ctx, repo.Config(), gogit.GoGitCloneOptions{
			Root:                   h.clonedir,
			SingleCommitBeforePush: !options.History,
		}, h.secrets, os.Stdout)
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

	dynamicClient, _, err := h.clients.New(repo.Config().Namespace)
	if err != nil {
		return fmt.Errorf("error getting client: %w", err)
	}

	worker := newMigrationWorker(ctx, repo, *options, dynamicClient, progress)

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

	return nil
}

func isEmptyRepo(tree []repository.FileTreeEntry) bool {
	for _, item := range tree {
		if strings.HasPrefix(item.Path, ".") {
			continue
		}
		if !item.Blob {
			return false // found a folder!
		}
		if !resources.ShouldIgnorePath(item.Path) {
			return false // has a json or yaml
		}
	}
	return true
}
