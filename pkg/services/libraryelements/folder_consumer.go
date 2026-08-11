package libraryelements

import (
	"context"
	"sync"
)

// FolderConsumer reports and deletes library elements by folder for the folder reconciler.
type FolderConsumer struct {
	svc  *LibraryElementService
	heal *FolderUIDHealService

	// warnOnce keeps the gate from logging on every reconcile tick.
	warnOnce sync.Once
}

func ProvideFolderConsumer(svc *LibraryElementService, heal *FolderUIDHealService) *FolderConsumer {
	return &FolderConsumer{svc: svc, heal: heal}
}

func (c *FolderConsumer) Name() string { return "library-elements" }

func (c *FolderConsumer) FoldersInUse(ctx context.Context, orgID int64) ([]string, error) {
	// Deleting by a folder_uid the heal has not yet repaired can remove a panel that lives in
	// a different, existing folder, so report nothing until the heal has run. Completion is
	// the gate, not the feature toggle: with the heal never run, nothing here is trustworthy.
	allowed, err := c.heal.cleanupAllowed(ctx)
	if err != nil {
		return nil, err
	}
	if !allowed {
		c.warnOnce.Do(func() {
			c.svc.log.Warn("Skipping library element folder cleanup until the folder UID heal has run; " +
				"enable the libraryElementFolderUIDHeal feature toggle")
		})
		return nil, nil
	}
	return c.svc.folderUIDsInUse(ctx, orgID)
}

func (c *FolderConsumer) DeleteInFolder(ctx context.Context, orgID int64, folderUID string) error {
	return c.svc.deleteLibraryElementsInFolderUIDUnchecked(ctx, orgID, folderUID)
}
