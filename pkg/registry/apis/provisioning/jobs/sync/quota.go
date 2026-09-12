package sync

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func recordQuotaBlockedCreate(ctx context.Context, path, ref string, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder) {
	result := jobs.NewResourceResult().WithPath(path).WithAction(repository.FileActionCreated)
	// A different manager can make this file unsyncable regardless of quota.
	// Inspect it without writing so warning classification does not depend on file order.
	name, gvk, size, err := repositoryResources.CheckResourceManagerKind(ctx, path, ref)
	result.WithName(name).WithGVK(gvk).WithBytes(size)
	if err != nil {
		result.WithError(fmt.Errorf("checking resource manager for file %s: %w", path, err))
	} else {
		result.WithError(quotas.NewQuotaExceededError(fmt.Errorf("resource quota exceeded, skipping creation of %s", path))).AsSkipped()
	}
	progress.Record(ctx, result.Build())
}
