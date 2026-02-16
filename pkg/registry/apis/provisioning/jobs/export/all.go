package export

import (
	"context"
	"fmt"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func ExportAll(ctx context.Context, repoName string, options provisioning.ExportJobOptions, quotaStatus provisioning.QuotaStatus, repoStats []provisioning.ResourceCount, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) error {
	// FIXME: should we sign with grafana user?

	folderClient, err := clients.Folder(ctx)
	if err != nil {
		return err
	}

	// Load the exportable folder tree (unmanaged folders only)
	tree, err := LoadExportableFolderTree(ctx, folderClient, progress)
	if err != nil {
		return err
	}

	// Load exportable non-folder resources (unmanaged only) in a single pass
	loaded, err := LoadExportableResources(ctx, clients, progress)
	if err != nil {
		return err
	}

	// Check quota before proceeding with the actual export
	netChange := int64(tree.Count()) + loaded.Count()
	if err := checkExportQuota(quotaStatus, repoStats, netChange); err != nil {
		return err
	}

	// Quota OK -- proceed with the actual export using pre-loaded data
	if err := ExportFoldersFromTree(ctx, options, tree, repositoryResources, progress); err != nil {
		return err
	}

	if err := ExportResourcesFromLoaded(ctx, options, loaded, repositoryResources, progress); err != nil {
		return err
	}

	return nil
}

// checkExportQuota verifies that exporting the given number of new resources
// won't exceed the repository's quota.
func checkExportQuota(quotaStatus provisioning.QuotaStatus, repoStats []provisioning.ResourceCount, netChange int64) error {
	if quotaStatus.MaxResourcesPerRepository == 0 {
		return nil
	}

	usage := quotas.NewQuotaUsageFromStats(repoStats)

	if ok := quotas.WouldStayWithinQuota(quotaStatus, usage, netChange); !ok {
		finalCount := usage.TotalResources + netChange
		return &quotas.QuotaExceededError{
			Err: fmt.Errorf("export would exceed quota: %d/%d resources",
				finalCount, quotaStatus.MaxResourcesPerRepository),
		}
	}

	return nil
}
