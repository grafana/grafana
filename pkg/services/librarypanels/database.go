package librarypanels

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// createLibraryPanel function adds a LibraryPanel
func (lps *LibraryPanelService) createLibraryPanel(c *models.ReqContext, cmd addLibraryPanelCommand) (LibraryPanel, error) {
	libraryPanel := LibraryPanel{
		OrgID:    c.SignedInUser.OrgId,
		FolderID: cmd.FolderID,
		Title:    cmd.Title,
		Model:    cmd.Model,

		Created: time.Now(),
		Updated: time.Now(),

		CreatedBy: c.SignedInUser.UserId,
		UpdatedBy: c.SignedInUser.UserId,
	}

	err := lps.SQLStore.WithTransactionalDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		if res, err := session.Query("SELECT 1 from library_panel WHERE org_id=? and folder_id=? and title=?", c.SignedInUser.OrgId, cmd.FolderID, cmd.Title); err != nil {
			return err
		} else if len(res) == 1 {
			return errLibraryPanelAlreadyAdded
		}

		if _, err := session.Insert(&libraryPanel); err != nil {
			return err
		}
		return nil
	})

	return libraryPanel, err
}
