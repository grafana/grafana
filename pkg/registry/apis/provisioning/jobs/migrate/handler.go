package migrate

import (
	"context"
	"errors"
	"fmt"
	"os"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	gogit "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/go-git"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

type MigrationHandler struct {
	// Tempdir for repo clones
	clonedir string

	// When exporting from apiservers
	clients *resources.ClientFactory

	// Check where values are currently saved
	storageStatus dualwrite.Service

	// Support reading from history
	legacyMigrator legacy.LegacyMigrator

	// Decrypt secret from config object
	secrets secrets.Service
}

func NewMigrationWorker(clients *resources.ClientFactory,
	legacyMigrator legacy.LegacyMigrator,
	storageStatus dualwrite.Service,
	secrets secrets.Service,
	clonedir string,
) *MigrationHandler {
	return &MigrationHandler{
		clonedir,
		clients,
		storageStatus,
		legacyMigrator,
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

		progress.SetMessage("create empty branch")
		_, err := buffered.CheckoutEmptyBranch(ctx, "")
		if err != nil {
			return fmt.Errorf("unable to create empty branch: %w", err)
		}
		repo = buffered // send all writes to the buffered repo
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

	return nil
}
