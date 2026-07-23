package service

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/folder"
)

// FolderConsumer deletes the dashboards contained in a folder for the folder reconciler.
type FolderConsumer struct {
	svc folder.RegistryService
}

func ProvideFolderConsumer(svc *DashboardServiceImpl) *FolderConsumer {
	return &FolderConsumer{svc: svc}
}

func (c *FolderConsumer) Name() string { return "dashboards" }

func (c *FolderConsumer) DeleteInFolder(ctx context.Context, orgID int64, folderUID string) error {
	// Authenticate as the system so the delete is attributed to the reconciler, not a user.
	ctx, user := identity.WithServiceIdentity(ctx, orgID, identity.WithServiceIdentityName("folder-async-reconciler"))
	if err := c.svc.DeleteInFolders(ctx, orgID, []string{folderUID}, user); err != nil {
		return err
	}
	// DeleteInFolders only logs per-dashboard failures, so re-check emptiness before reporting success;
	// otherwise the reconciler would drop the finalizer and orphan any dashboard that failed to delete.
	remaining, err := c.svc.CountInFolders(ctx, orgID, []string{folderUID}, user)
	if err != nil {
		return err
	}
	if remaining > 0 {
		return fmt.Errorf("%d dashboard(s) still present in folder %q after delete", remaining, folderUID)
	}
	return nil
}
