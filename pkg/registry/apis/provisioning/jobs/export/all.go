package export

import (
	"context"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// ExportAll exports all resources preserving their original metadata.name.
// Used by the migrate worker so the takeover allowlist can correlate
// exported resources back to the originals during the sync phase.
func ExportAll(ctx context.Context, repoName string, options provisioning.ExportJobOptions, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	return exportAll(ctx, repoName, options, clients, repositoryResources, progress, false)
}

// ExportAllWithNewUIDs exports all resources with newly generated metadata.name values.
// Used by the standalone export worker so exported files don't reference
// existing resource identifiers, avoiding conflicts on subsequent sync.
func ExportAllWithNewUIDs(ctx context.Context, repoName string, options provisioning.ExportJobOptions, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	return exportAll(ctx, repoName, options, clients, repositoryResources, progress, true)
}

func exportAll(ctx context.Context, repoName string, options provisioning.ExportJobOptions, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, generateNewUIDs bool) error {
	// FIXME: should we sign with grafana user?

	folderClient, err := clients.Folder(ctx)
	if err != nil {
		return err
	}

	if err := ExportFolders(ctx, repoName, options, folderClient, repositoryResources, progress); err != nil {
		return err
	}

	if err := ExportResources(ctx, options, clients, repositoryResources, progress, generateNewUIDs); err != nil {
		return err
	}

	return nil
}
