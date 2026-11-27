package migrate

import (
	"context"
	"errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type migrationExporterFunc func(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder, folderCheck *resources.FolderCheckOptions) (*resources.FolderCheckResults, error)

func (f migrationExporterFunc) ExportForMigration(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder, folderCheck *resources.FolderCheckOptions) (*resources.FolderCheckResults, error) {
	return f(ctx, repo, job, progress, folderCheck)
}

// exporterWithoutFolderCheck runs the export with worker. The worker cannot
// run the folder UID check. If the exporter ignored the check, unclean folders
// would keep their UID. So it fails when the migration asks for the check.
func exporterWithoutFolderCheck(worker jobs.Worker) MigrationExporter {
	return migrationExporterFunc(func(ctx context.Context, repo repository.Repository, job provisioning.Job, progress jobs.JobProgressRecorder, folderCheck *resources.FolderCheckOptions) (*resources.FolderCheckResults, error) {
		if folderCheck != nil {
			return nil, errors.New("exporter does not support the folder UID check")
		}
		return nil, worker.Process(ctx, repo, job, progress)
	})
}
