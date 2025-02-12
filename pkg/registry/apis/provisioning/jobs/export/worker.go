package export

import (
	"context"
	"fmt"
	"os"

	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboards "github.com/grafana/grafana/pkg/apis/dashboard"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	gogit "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/go-git"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type ExportWorker struct {
	clients  *resources.ClientFactory
	clonedir string
}

func NewExportWorker(clients *resources.ClientFactory, clonedir string) *ExportWorker {
	return &ExportWorker{clients, clonedir}
}

func (r *ExportWorker) IsSupported(ctx context.Context, job provisioning.Job) bool {
	return job.Spec.Action == provisioning.JobActionExport
}

// Process will start a job
func (r *ExportWorker) Process(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.ProgressFn) (*provisioning.JobStatus, error) {
	if repo.Config().Spec.ReadOnly {
		return &provisioning.JobStatus{
			State:  provisioning.JobStateError,
			Errors: []string{"Exporting to a read only repository is not supported"},
		}, nil
	}

	options := job.Spec.Export
	if options == nil {
		return &provisioning.JobStatus{
			State:  provisioning.JobStateError,
			Errors: []string{"Export job missing export settings"},
		}, nil
	}

	var err error
	var buffered *gogit.GoGitRepo
	if repo.Config().Spec.GitHub != nil {
		buffered, err = gogit.Clone(ctx, repo.Config(), gogit.GoGitCloneOptions{
			Root:                   r.clonedir,
			SingleCommitBeforePush: !options.History,
		}, os.Stdout)
		if err != nil {
			return &provisioning.JobStatus{
				State:  provisioning.JobStateError,
				Errors: []string{"Unable to clone target", err.Error()},
			}, nil
		}

		// New empty branch
		if options.Branch != "" {
			_, err := buffered.NewEmptyBranch(ctx, options.Branch)
			if err != nil {
				return &provisioning.JobStatus{
					State:  provisioning.JobStateError,
					Errors: []string{"Unable to create empty branch", err.Error()},
				}, nil
			}
		}
		repo = buffered     // send all writes to the buffered repo
		options.Branch = "" // :( the branch is now baked into the repo
	}

	dynamicClient, _, err := r.clients.New(repo.Config().Namespace)
	if err != nil {
		return nil, fmt.Errorf("namespace mismatch")
	}

	worker := newExportJob(ctx, repo, *options, dynamicClient, progress)

	// Load and write all folders
	err = worker.loadFolders(ctx)
	if err != nil {
		return worker.jobStatus, err
	}

	kinds := []schema.GroupVersionResource{{
		Group:    dashboards.GROUP,
		Version:  "v1alpha1",
		Resource: dashboards.DASHBOARD_RESOURCE,
	}}
	for _, kind := range kinds {
		err = worker.export(ctx, kind)
		if err != nil {
			return worker.jobStatus, err
		}
	}

	status := worker.jobStatus
	if buffered != nil && status.State != provisioning.JobStateError {
		status.Message = "pushing changes..."
		worker.maybeNotify(ctx) // force notify?
		err = buffered.Push(ctx, os.Stdout)
		status.Message = ""
	}

	// Add summary info to response
	if !status.State.Finished() && err == nil {
		status.State = provisioning.JobStateSuccess
		status.Message = ""
	}
	return status, err
}
