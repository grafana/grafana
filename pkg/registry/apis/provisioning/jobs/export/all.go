package export

import (
	"context"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func ExportAll(ctx context.Context, repoName string, options provisioning.ExportJobOptions, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	// FIXME: should we sign with grafana user?

	folderClient, err := clients.Folder()
	if err != nil {
		return err
	}

	if err := ExportFolders(ctx, repoName, options, folderClient, repositoryResources, progress); err != nil {
		return err
	}

	if err := ExportResources(ctx, options, clients, repositoryResources, progress); err != nil {
		return err
	}

	return nil
}
