package librarypanels

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// createLibraryPanel adds a Library Panel
func (lps *LibraryPanelService) createLibraryPanel(c *models.ReqContext, cmd createLibraryPanelCommand) (LibraryPanel, error) {
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
		if res, err := session.Query("SELECT 1 FROM library_panel WHERE org_id=? AND folder_id=? AND title=?",
			c.SignedInUser.OrgId, cmd.FolderID, cmd.Title); err != nil {
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

// deleteLibraryPanel deletes a Library Panel
func (lps *LibraryPanelService) deleteLibraryPanel(c *models.ReqContext, panelID int64) error {
	orgID := c.SignedInUser.OrgId
	return lps.SQLStore.WithTransactionalDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		result, err := session.Exec("DELETE FROM library_panel WHERE id=? and org_id=?", panelID, orgID)
		if err != nil {
			return err
		}

		if rowsAffected, err := result.RowsAffected(); err != nil {
			return err
		} else if rowsAffected != 1 {
			return errLibraryPanelNotFound
		}

		return nil
	})
}

// getLibraryPanel gets a Library Panel.
func (lps *LibraryPanelService) getLibraryPanel(c *models.ReqContext, panelID int64) (LibraryPanel, error) {
	orgID := c.SignedInUser.OrgId
	var libraryPanel LibraryPanel
	err := lps.SQLStore.WithDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		libraryPanels := make([]LibraryPanel, 0)
		err := session.SQL("SELECT * FROM library_panel WHERE id=? and org_id=?", panelID, orgID).Find(&libraryPanels)
		if err != nil {
			return err
		}

		if len(libraryPanels) == 0 {
			return errLibraryPanelNotFound
		}
		if len(libraryPanels) > 1 {
			return fmt.Errorf("found %d panels, while expecting at most one", len(libraryPanels))
		}

		libraryPanel = libraryPanels[0]

		return nil
	})

	return libraryPanel, err
}

// getAllLibraryPanels gets all library panels.
func (lps *LibraryPanelService) getAllLibraryPanels(c *models.ReqContext) ([]LibraryPanel, error) {
	orgID := c.SignedInUser.OrgId
	libraryPanels := make([]LibraryPanel, 0)

	err := lps.SQLStore.WithDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		err := session.SQL("SELECT * FROM library_panel WHERE org_id=?", orgID).Find(&libraryPanels)
		if err != nil {
			return err
		}

		return nil
	})

	return libraryPanels, err
}
