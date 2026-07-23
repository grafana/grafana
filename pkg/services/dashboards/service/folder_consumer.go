package service

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// FolderConsumer deletes the dashboards contained in a folder for the folder reconciler.
type FolderConsumer struct {
	svc *DashboardServiceImpl
}

func ProvideFolderConsumer(svc *DashboardServiceImpl) *FolderConsumer {
	return &FolderConsumer{svc: svc}
}

func (c *FolderConsumer) Name() string { return "dashboards" }

func (c *FolderConsumer) DeleteInFolder(ctx context.Context, orgID int64, folderUID string) error {
	// Authenticate as the system so the delete is attributed to the reconciler, not a user.
	ctx, user := identity.WithServiceIdentity(ctx, orgID, identity.WithServiceIdentityName("folder-async-reconciler"))
	return c.svc.DeleteInFolders(ctx, orgID, []string{folderUID}, user)
}
