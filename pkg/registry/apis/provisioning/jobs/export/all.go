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
	progress.SetMessage(ctx, "read folder tree from API server")
	tree, err := LoadExportableFolderTree(ctx, folderClient)
	if err != nil {
		return err
	}

	// Count exportable non-folder resources (unmanaged only)
	progress.SetMessage(ctx, "counting exportable resources")
	resourceCount, err := CountExportableResources(ctx, clients)
	if err != nil {
		return err
	}

	// Check quota before proceeding with the actual export
	netChange := int64(tree.Count()) + resourceCount
	if err := checkExportQuota(quotaStatus, repoStats, netChange); err != nil {
		return err
	}

	// Quota OK -- proceed with the actual export using the pre-built tree
	if err := ExportFoldersFromTree(ctx, options, tree, repositoryResources, progress); err != nil {
		return err
	}

	if err := ExportResources(ctx, options, clients, repositoryResources, progress); err != nil {
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
