package libraryelements

import (
	"context"
	"sync"
)

// FolderConsumer reports and deletes library elements by folder for the folder reconciler.
type FolderConsumer struct {
	svc  *LibraryElementService
	heal *FolderUIDHealService

	// warnedOrgs keeps the gate from logging on every reconcile tick.
	warnedOrgs sync.Map
}

func ProvideFolderConsumer(svc *LibraryElementService, heal *FolderUIDHealService) *FolderConsumer {
	return &FolderConsumer{svc: svc, heal: heal}
}

func (c *FolderConsumer) Name() string { return "library-elements" }

func (c *FolderConsumer) FoldersInUse(ctx context.Context, orgID int64) ([]string, error) {
	// Deleting by a folder_uid the heal has not yet repaired can remove a panel that lives in
	// a different, existing folder, so report nothing until this org is marked. The marker is
	// the gate, not the feature toggle: with the heal never run, nothing here is trustworthy.
	healed, err := c.heal.isHealed(ctx, orgID)
	if err != nil {
		return nil, err
	}
	if !healed {
		if _, warned := c.warnedOrgs.LoadOrStore(orgID, struct{}{}); !warned {
			c.svc.log.Warn("Skipping library element folder cleanup until the folder UID heal has run; "+
				"enable the libraryElementFolderUIDHeal feature toggle", "org_id", orgID)
		}
		return nil, nil
	}
	return c.svc.folderUIDsInUse(ctx, orgID)
}

func (c *FolderConsumer) DeleteInFolder(ctx context.Context, orgID int64, folderUID string) error {
	return c.svc.deleteLibraryElementsInFolderUIDUnchecked(ctx, orgID, folderUID)
}
