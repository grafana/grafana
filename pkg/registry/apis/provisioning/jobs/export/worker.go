package export

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
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

	// required to create clients
	clientFactory *resources.ClientFactory

	// Check where values are currently saved
	storageStatus dualwrite.Service

	// Decrypt secrets in config
	secrets secrets.Service
}

func NewExportWorker(clientFactory *resources.ClientFactory,
	storageStatus dualwrite.Service,
	secrets secrets.Service,
	clonedir string,
) *ExportWorker {
	return &ExportWorker{
		clonedir,
		clientFactory,
		storageStatus,
		secrets,
	}
}

func (r *ExportWorker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionExport
}

// Process will start a job
func (r *ExportWorker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder) error {
	options := job.Spec.Push
	if options == nil {
		return errors.New("missing export settings")
	}

	// Can write to external branch
	err := repository.IsWriteAllowed(repo.Config(), options.Branch)
	if err != nil {
		return err
	}

	// Use the existing clone if already checked out
	buffered, ok := repo.(*gogit.GoGitRepo)
	if !ok && repo.Config().Spec.GitHub != nil {
		progress.SetMessage(ctx, "clone target")
		buffered, err = gogit.Clone(ctx, repo.Config(), gogit.GoGitCloneOptions{
			Root:                   r.clonedir,
			SingleCommitBeforePush: true,
			// TODO: make this configurable
			Timeout: 10 * time.Minute,
		}, r.secrets, os.Stdout)
		if err != nil {
			return fmt.Errorf("unable to clone target: %w", err)
		}

		repo = buffered // send all writes to the buffered repo
		defer func() {
			if err := buffered.Remove(ctx); err != nil {
				logging.FromContext(ctx).Error("failed to remove cloned repository after export", "err", err)
			}
		}()

		options.Branch = "" // :( the branch is now baked into the repo
	}

	rw, ok := repo.(repository.ReaderWriter)
	if !ok {
		return errors.New("export job submitted targeting repository that is not a ReaderWriter")
	}

	clients, err := r.clientFactory.Clients(ctx, repo.Config().Namespace)
	if err != nil {
		return err
	}

	worker := newExportJob(ctx, rw, *options, clients, progress)

	// Load and write all folders
	progress.SetMessage(ctx, "start folder export")
	err = worker.loadFolders(ctx)
	if err != nil {
		return err
	}

	progress.SetMessage(ctx, "start resource export")
	err = worker.loadResources(ctx)
	if err != nil {
		return err
	}

	if buffered != nil {
		progress.SetMessage(ctx, "push changes")
		if err := buffered.Push(ctx, gogit.GoGitPushOptions{
			// TODO: make this configurable
			Timeout: 10 * time.Minute,
		}, os.Stdout); err != nil {
			return fmt.Errorf("error pushing changes: %w", err)
		}
	}

	return nil
}
