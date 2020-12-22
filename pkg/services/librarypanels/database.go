package librarypanels

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/util"

	"github.com/grafana/grafana/pkg/models"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// createLibraryPanel adds a Library Panel.
func (lps *LibraryPanelService) createLibraryPanel(c *models.ReqContext, cmd createLibraryPanelCommand) (LibraryPanel, error) {
	libraryPanel := LibraryPanel{
		OrgID:    c.SignedInUser.OrgId,
		FolderID: cmd.FolderID,
		UID:      util.GenerateShortUID(),
		Name:     cmd.Name,
		Model:    cmd.Model,

		Created: time.Now(),
		Updated: time.Now(),

		CreatedBy: c.SignedInUser.UserId,
		UpdatedBy: c.SignedInUser.UserId,
	}
	err := lps.SQLStore.WithTransactionalDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		if res, err := session.Query("SELECT 1 FROM library_panel WHERE org_id=? AND folder_id=? AND name=?",
			c.SignedInUser.OrgId, cmd.FolderID, cmd.Name); err != nil {
			return err
		} else if len(res) == 1 {
			return errLibraryPanelAlreadyExists
		}

		if _, err := session.Insert(&libraryPanel); err != nil {
			return err
		}
		return nil
	})

	return libraryPanel, err
}

// deleteLibraryPanel deletes a Library Panel.
func (lps *LibraryPanelService) deleteLibraryPanel(c *models.ReqContext, uid string) error {
	orgID := c.SignedInUser.OrgId
	return lps.SQLStore.WithTransactionalDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		result, err := session.Exec("DELETE FROM library_panel WHERE uid=? and org_id=?", uid, orgID)
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

func getLibraryPanel(session *sqlstore.DBSession, uid string, orgID int64) (LibraryPanel, error) {
	libraryPanels := make([]LibraryPanel, 0)
	session.Table("library_panel")
	session.Where("uid=? and org_id=?", uid, orgID)
	err := session.Find(&libraryPanels)
	if err != nil {
		return LibraryPanel{}, err
	}
	if len(libraryPanels) == 0 {
		return LibraryPanel{}, errLibraryPanelNotFound
	}
	if len(libraryPanels) > 1 {
		return LibraryPanel{}, fmt.Errorf("found %d panels, while expecting at most one", len(libraryPanels))
	}

	return libraryPanels[0], nil
}

// getLibraryPanel gets a Library Panel.
func (lps *LibraryPanelService) getLibraryPanel(c *models.ReqContext, uid string) (LibraryPanel, error) {
	var libraryPanel LibraryPanel
	err := lps.SQLStore.WithDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		var err error
		libraryPanel, err = getLibraryPanel(session, uid, c.SignedInUser.OrgId)
		return err
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

// updateLibraryPanel updates a Library Panel.
func (lps *LibraryPanelService) updateLibraryPanel(c *models.ReqContext, cmd updateLibraryPanelCommand) (LibraryPanel, error) {
	var libraryPanel LibraryPanel
	err := lps.SQLStore.WithTransactionalDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		panelInDb, err := getLibraryPanel(session, cmd.UID, c.SignedInUser.OrgId)
		if err != nil {
			return err
		}

		libraryPanel = LibraryPanel{
			ID:        panelInDb.ID,
			OrgID:     c.SignedInUser.OrgId,
			FolderID:  cmd.FolderID,
			UID:       cmd.UID,
			Name:      cmd.Name,
			Model:     cmd.Model,
			Created:   panelInDb.Created,
			CreatedBy: panelInDb.CreatedBy,
			Updated:   time.Now(),
			UpdatedBy: c.SignedInUser.UserId,
		}

		if cmd.FolderID == 0 {
			libraryPanel.FolderID = panelInDb.FolderID
		}
		if cmd.Name == "" {
			libraryPanel.Name = panelInDb.Name
		}
		if cmd.Model == nil {
			libraryPanel.Model = panelInDb.Model
		}

		if res, err := session.Query("SELECT 1 FROM library_panel WHERE org_id=? AND folder_id=? AND name=? AND uid <>?",
			libraryPanel.OrgID, libraryPanel.FolderID, libraryPanel.Name, libraryPanel.UID); err != nil {
			return err
		} else if len(res) == 1 {
			return errLibraryPanelAlreadyExists
		}

		if rowsAffected, err := session.ID(panelInDb.ID).Update(&libraryPanel); err != nil {
			return err
		} else if rowsAffected != 1 {
			return errLibraryPanelNotFound
		}

		return nil
	})

	return libraryPanel, err
}
