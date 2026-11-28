package export

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/util/sets"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// ExportAll exports all resources preserving their original metadata.name.
// Used by the migrate worker so the takeover allowlist can correlate
// exported resources back to the originals during the sync phase.
func ExportAll(ctx context.Context, options provisioning.ExportJobOptions, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, folderCheck *resources.FolderCheckOptions) (*resources.FolderCheckResults, error) {
	return exportAll(ctx, options, clients, repositoryResources, progress, false, folderCheck)
}

// ExportAllWithNewUIDs exports all resources with newly generated metadata.name values.
// Used by the standalone export worker so exported files don't reference
// existing resource identifiers, avoiding conflicts on subsequent sync.
func ExportAllWithNewUIDs(ctx context.Context, options provisioning.ExportJobOptions, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, folderCheck *resources.FolderCheckOptions) (*resources.FolderCheckResults, error) {
	return exportAll(ctx, options, clients, repositoryResources, progress, true, folderCheck)
}

func exportAll(ctx context.Context, options provisioning.ExportJobOptions, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, generateNewUIDs bool, folderCheck *resources.FolderCheckOptions) (*resources.FolderCheckResults, error) {
	// FIXME: should we sign with grafana user?
	folderClient, _, err := clients.Folder(ctx)
	if err != nil {
		return nil, err
	}

	// A selective export must not pull in the entire instance folder tree: only
	// the folders needed to place the requested resources are written, and each
	// resource's missing parent folder is generated on demand from its ancestry.
	if len(options.Resources) > 0 {
		return ExportSpecificResources(ctx, options, folderClient, clients, repositoryResources, progress, generateNewUIDs, folderCheck)
	}

	var planner *folderUIDPlanner
	if folderUIDCheckRequested(options, folderCheck) {
		progress.SetMessage(ctx, "count resources in folders")
		exported, supported, err := countExportableResources(ctx, clients)
		if err != nil {
			return nil, fmt.Errorf("count resources in folders: %w", err)
		}
		planner = newFolderUIDPlanner(*folderCheck, folderClient, supported, exported)
	}

	folderCheckResults, err := exportFolders(ctx, options, folderClient, repositoryResources, progress, planner)
	if err != nil {
		return nil, err
	}

	if err := ExportResources(ctx, options, clients, repositoryResources, progress, generateNewUIDs, skippedFolderSet(folderCheckResults)); err != nil {
		return nil, err
	}
	return folderCheckResults, nil
}

// skippedFolderSet returns the folders that the folder UID check left out of
// the export, or an empty set when the check did not run.
func skippedFolderSet(folderCheckResults *resources.FolderCheckResults) sets.Set[string] {
	if folderCheckResults == nil {
		return nil
	}
	return sets.New(folderCheckResults.Skipped...)
}
