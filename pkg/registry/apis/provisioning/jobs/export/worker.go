package export

import (
	"context"
	"errors"
	"fmt"
	"os"

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

	// When exporting from apiservers
	clients *resources.ClientFactory

	// Check where values are currently saved
	storageStatus dualwrite.Service

	// Decrypt secrets in config
	secrets secrets.Service
}

func NewExportWorker(clients *resources.ClientFactory,
	storageStatus dualwrite.Service,
	secrets secrets.Service,
	clonedir string,
) *ExportWorker {
	return &ExportWorker{
		clonedir,
		clients,
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
	if err := repository.IsWriteAllowed(repo.Config(), options.Branch); err != nil {
		return err
	}

	var (
		err      error
		buffered *gogit.GoGitRepo
	)

	if repo.Config().Spec.GitHub != nil {
		progress.SetMessage("clone target")
		buffered, err = gogit.Clone(ctx, repo.Config(), gogit.GoGitCloneOptions{
			Root:                   r.clonedir,
			SingleCommitBeforePush: true,
		}, r.secrets, os.Stdout)
		if err != nil {
			return fmt.Errorf("unable to clone target: %w", err)
		}

		repo = buffered     // send all writes to the buffered repo
		options.Branch = "" // :( the branch is now baked into the repo
	}

	rw, ok := repo.(repository.ReaderWriter)
	if !ok {
		return errors.New("export job submitted targeting repository that is not a ReaderWriter")
	}

	dynamicClient, _, err := r.clients.New(rw.Config().Namespace)
	if err != nil {
		return fmt.Errorf("error getting client: %w", err)
	}

	worker := newExportJob(ctx, rw, *options, dynamicClient, progress)

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
