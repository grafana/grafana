package export

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

type ExportWorker struct {
	// Tempdir for repo clones
	clonedir string

	// When exporting from apiservers
	clients *resources.ClientFactory

	// Check where values are currently saved
	storageStatus dualwrite.Service

	// Support reading from history
	legacyMigrator legacy.LegacyMigrator

	secrets secrets.Service
}

func NewExportWorker(clients *resources.ClientFactory,
	legacyMigrator legacy.LegacyMigrator,
	storageStatus dualwrite.Service,
	secrets secrets.Service,
	clonedir string,
) *ExportWorker {
	return &ExportWorker{
		clonedir,
		clients,
		storageStatus,
		legacyMigrator,
		secrets,
	}
}

func (r *ExportWorker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionExport
}

// Process will start a job
func (r *ExportWorker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	if repo.Config().Spec.ReadOnly {
		return errors.New("read only repository")
	}

	options := job.Spec.Export
	if options == nil {
		return errors.New("missing export settings")
	}

	var (
		err      error
		buffered *gogit.GoGitRepo
	)

	if repo.Config().Spec.GitHub != nil {
		progress.SetMessage("clone target")
		buffered, err = gogit.Clone(ctx, repo.Config(), gogit.GoGitCloneOptions{
			Root:                   r.clonedir,
			SingleCommitBeforePush: !options.History,
		}, r.secrets, os.Stdout)
		if err != nil {
			return fmt.Errorf("unable to clone target: %w", err)
		}

		// New empty branch (same on main???)
		progress.SetMessage("create empty branch")
		_, err := buffered.CheckoutEmptyBranch(ctx, options.Branch) // or
		if err != nil {
			return fmt.Errorf("unable to create empty branch: %w", err)
		}

		repo = buffered     // send all writes to the buffered repo
		options.Branch = "" // :( the branch is now baked into the repo
	}

	dynamicClient, _, err := r.clients.New(repo.Config().Namespace)
	if err != nil {
		return fmt.Errorf("error getting client: %w", err)
	}

	worker := newExportJob(ctx, repo, *options, dynamicClient, progress)

	if options.History {
		progress.SetMessage("load users")
		err = worker.loadUsers(ctx)
		if err != nil {
			return fmt.Errorf("error loading users: %w", err)
		}
	}

	// Read from legacy if not yet using unified storage
	if dualwrite.IsReadingLegacyDashboardsAndFolders(ctx, r.storageStatus) {
		worker.legacy = r.legacyMigrator
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
