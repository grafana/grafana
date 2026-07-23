package libraryelements

import (
	"context"
)

// FolderConsumer reports and deletes library elements by folder for the folder reconciler.
type FolderConsumer struct {
	svc *LibraryElementService
}

func ProvideFolderConsumer(svc *LibraryElementService) *FolderConsumer {
	return &FolderConsumer{svc: svc}
}

func (c *FolderConsumer) Name() string { return "library-elements" }

func (c *FolderConsumer) FoldersInUse(ctx context.Context, orgID int64) ([]string, error) {
	return c.svc.folderUIDsInUse(ctx, orgID)
}

func (c *FolderConsumer) DeleteInFolder(ctx context.Context, orgID int64, folderUID string) error {
	return c.svc.deleteLibraryElementsInFolderUIDUnchecked(ctx, orgID, folderUID)
}
