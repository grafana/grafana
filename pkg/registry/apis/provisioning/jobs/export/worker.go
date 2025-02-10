package export

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboards "github.com/grafana/grafana/pkg/apis/dashboard"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type ExportWorker struct {
	clients *resources.ClientFactory
}

func NewExportWorker(clients *resources.ClientFactory) *ExportWorker {
	return &ExportWorker{clients}
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

	// TODO: remove this dummy export
	if job.Spec.Export.Branch == "*dummy*" {
		return dummyExport(ctx, repo, job, progress)
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

	// Add summary info to response
	status := worker.jobStatus
	if !status.State.Finished() && err == nil {
		status.State = provisioning.JobStateSuccess
		status.Message = ""
	}
	return status, err
}
