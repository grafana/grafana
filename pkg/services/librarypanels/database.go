package librarypanels

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util"
)

// createLibraryPanel adds a Library Panel.
func (lps *LibraryPanelService) createLibraryPanel(c *models.ReqContext, cmd createLibraryPanelCommand) (LibraryPanelDTO, error) {
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
		if _, err := session.Insert(&libraryPanel); err != nil {
			if lps.SQLStore.Dialect.IsUniqueConstraintViolation(err) {
				return errLibraryPanelAlreadyExists
			}
			return err
		}
		return nil
	})

	dto := LibraryPanelDTO{
		ID:       libraryPanel.ID,
		OrgID:    libraryPanel.OrgID,
		FolderID: libraryPanel.FolderID,
		UID:      libraryPanel.UID,
		Name:     libraryPanel.Name,
		Model:    libraryPanel.Model,
		Meta: LibraryPanelDTOMeta{
			CanEdit: true,
			Created: libraryPanel.Created,
			Updated: libraryPanel.Updated,
			CreatedBy: LibraryPanelDTOMetaUser{
				ID:        libraryPanel.CreatedBy,
				Name:      c.SignedInUser.Login,
				AvatarUrl: dtos.GetGravatarUrl(c.SignedInUser.Email),
			},
			UpdatedBy: LibraryPanelDTOMetaUser{
				ID:        libraryPanel.UpdatedBy,
				Name:      c.SignedInUser.Login,
				AvatarUrl: dtos.GetGravatarUrl(c.SignedInUser.Email),
			},
		},
	}

	return dto, err
}

func connectDashboard(session *sqlstore.DBSession, dialect migrator.Dialect, user *models.SignedInUser, uid string, dashboardID int64) error {
	panel, err := getLibraryPanel(session, uid, user.OrgId)
	if err != nil {
		return err
	}

	// TODO add check that dashboard exists

	libraryPanelDashboard := libraryPanelDashboard{
		DashboardID:    dashboardID,
		LibraryPanelID: panel.ID,
		Created:        time.Now(),
		CreatedBy:      user.UserId,
	}
	if _, err := session.Insert(&libraryPanelDashboard); err != nil {
		if dialect.IsUniqueConstraintViolation(err) {
			return nil
		}
		return err
	}
	return nil
}

// connectDashboard adds a connection between a Library Panel and a Dashboard.
func (lps *LibraryPanelService) connectDashboard(c *models.ReqContext, uid string, dashboardID int64) error {
	err := lps.SQLStore.WithTransactionalDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		return connectDashboard(session, lps.SQLStore.Dialect, c.SignedInUser, uid, dashboardID)
	})

	return err
}

// connectLibraryPanelsForDashboard adds connections for all Library Panels in a Dashboard.
func (lps *LibraryPanelService) connectLibraryPanelsForDashboard(c *models.ReqContext, uids []string, dashboardID int64) error {
	err := lps.SQLStore.WithTransactionalDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		for _, uid := range uids {
			err := connectDashboard(session, lps.SQLStore.Dialect, c.SignedInUser, uid, dashboardID)
			if err != nil {
				return err
			}
		}
		return nil
	})

	return err
}

// deleteLibraryPanel deletes a Library Panel.
func (lps *LibraryPanelService) deleteLibraryPanel(c *models.ReqContext, uid string) error {
	return lps.SQLStore.WithTransactionalDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		panel, err := getLibraryPanel(session, uid, c.SignedInUser.OrgId)
		if err != nil {
			return err
		}

		if _, err := session.Exec("DELETE FROM library_panel_dashboard WHERE librarypanel_id=?", panel.ID); err != nil {
			return err
		}

		result, err := session.Exec("DELETE FROM library_panel WHERE id=?", panel.ID)
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

// disconnectDashboard deletes a connection between a Library Panel and a Dashboard.
func (lps *LibraryPanelService) disconnectDashboard(c *models.ReqContext, uid string, dashboardID int64) error {
	return lps.SQLStore.WithTransactionalDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		panel, err := getLibraryPanel(session, uid, c.SignedInUser.OrgId)
		if err != nil {
			return err
		}

		result, err := session.Exec("DELETE FROM library_panel_dashboard WHERE librarypanel_id=? and dashboard_id=?", panel.ID, dashboardID)
		if err != nil {
			return err
		}

		if rowsAffected, err := result.RowsAffected(); err != nil {
			return err
		} else if rowsAffected != 1 {
			return errLibraryPanelDashboardNotFound
		}

		return nil
	})
}

// disconnectLibraryPanelsForDashboard deletes connections for all Library Panels in a Dashboard.
func (lps *LibraryPanelService) disconnectLibraryPanelsForDashboard(dashboardID int64, panelCount int64) error {
	return lps.SQLStore.WithTransactionalDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		result, err := session.Exec("DELETE FROM library_panel_dashboard WHERE dashboard_id=?", dashboardID)
		if err != nil {
			return err
		}
		if rowsAffected, err := result.RowsAffected(); err != nil {
			return err
		} else if rowsAffected != panelCount {
			lps.log.Warn("Number of disconnects does not match number of panels", "dashboard", dashboardID, "rowsAffected", rowsAffected, "panelCount", panelCount)
		}

		return nil
	})
}

func getLibraryPanel(session *sqlstore.DBSession, uid string, orgID int64) (LibraryPanelWithMeta, error) {
	libraryPanels := make([]LibraryPanelWithMeta, 0)
	sql := `SELECT
				lp.id, lp.org_id, lp.folder_id, lp.uid, lp.name, lp.model, lp.created, lp.created_by, lp.updated, lp.updated_by
				, 0 AS can_edit
				, u1.login AS created_by_name
				, u1.email AS created_by_email
				, u2.login AS updated_by_name
				, u2.email AS updated_by_email
			FROM library_panel AS lp
			LEFT JOIN user AS u1 ON lp.created_by = u1.id
			LEFT JOIN user AS u2 ON lp.updated_by = u2.id
			WHERE lp.uid=? AND lp.org_id=?`

	sess := session.SQL(sql, uid, orgID)
	err := sess.Find(&libraryPanels)
	if err != nil {
		return LibraryPanelWithMeta{}, err
	}
	if len(libraryPanels) == 0 {
		return LibraryPanelWithMeta{}, errLibraryPanelNotFound
	}
	if len(libraryPanels) > 1 {
		return LibraryPanelWithMeta{}, fmt.Errorf("found %d panels, while expecting at most one", len(libraryPanels))
	}

	return libraryPanels[0], nil
}

// getLibraryPanel gets a Library Panel.
func (lps *LibraryPanelService) getLibraryPanel(c *models.ReqContext, uid string) (LibraryPanelDTO, error) {
	var libraryPanel LibraryPanelWithMeta
	err := lps.SQLStore.WithDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		var err error
		libraryPanel, err = getLibraryPanel(session, uid, c.SignedInUser.OrgId)
		return err
	})

	dto := LibraryPanelDTO{
		ID:       libraryPanel.ID,
		OrgID:    libraryPanel.OrgID,
		FolderID: libraryPanel.FolderID,
		UID:      libraryPanel.UID,
		Name:     libraryPanel.Name,
		Model:    libraryPanel.Model,
		Meta: LibraryPanelDTOMeta{
			CanEdit: true,
			Created: libraryPanel.Created,
			Updated: libraryPanel.Updated,
			CreatedBy: LibraryPanelDTOMetaUser{
				ID:        libraryPanel.CreatedBy,
				Name:      libraryPanel.CreatedByName,
				AvatarUrl: dtos.GetGravatarUrl(libraryPanel.CreatedByEmail),
			},
			UpdatedBy: LibraryPanelDTOMetaUser{
				ID:        libraryPanel.UpdatedBy,
				Name:      libraryPanel.UpdatedByName,
				AvatarUrl: dtos.GetGravatarUrl(libraryPanel.UpdatedByEmail),
			},
		},
	}

	return dto, err
}

// getAllLibraryPanels gets all library panels.
func (lps *LibraryPanelService) getAllLibraryPanels(c *models.ReqContext) ([]LibraryPanelDTO, error) {
	orgID := c.SignedInUser.OrgId
	libraryPanels := make([]LibraryPanelWithMeta, 0)
	err := lps.SQLStore.WithDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		sql := `SELECT
				lp.id, lp.org_id, lp.folder_id, lp.uid, lp.name, lp.model, lp.created, lp.created_by, lp.updated, lp.updated_by
				, 0 AS can_edit
				, u1.login AS created_by_name
				, u1.email AS created_by_email
				, u2.login AS updated_by_name
				, u2.email AS updated_by_email
			FROM library_panel AS lp
			LEFT JOIN user AS u1 ON lp.created_by = u1.id
			LEFT JOIN user AS u2 ON lp.updated_by = u2.id
			WHERE lp.org_id=?`

		sess := session.SQL(sql, orgID)
		err := sess.Find(&libraryPanels)
		if err != nil {
			return err
		}

		return nil
	})

	retDTOs := make([]LibraryPanelDTO, 0)
	for _, panel := range libraryPanels {
		retDTOs = append(retDTOs, LibraryPanelDTO{
			ID:       panel.ID,
			OrgID:    panel.OrgID,
			FolderID: panel.FolderID,
			UID:      panel.UID,
			Name:     panel.Name,
			Model:    panel.Model,
			Meta: LibraryPanelDTOMeta{
				CanEdit: true,
				Created: panel.Created,
				Updated: panel.Updated,
				CreatedBy: LibraryPanelDTOMetaUser{
					ID:        panel.CreatedBy,
					Name:      panel.CreatedByName,
					AvatarUrl: dtos.GetGravatarUrl(panel.CreatedByEmail),
				},
				UpdatedBy: LibraryPanelDTOMetaUser{
					ID:        panel.UpdatedBy,
					Name:      panel.UpdatedByName,
					AvatarUrl: dtos.GetGravatarUrl(panel.UpdatedByEmail),
				},
			},
		})
	}

	return retDTOs, err
}

// getConnectedDashboards gets all dashboards connected to a Library Panel.
func (lps *LibraryPanelService) getConnectedDashboards(c *models.ReqContext, uid string) ([]int64, error) {
	connectedDashboardIDs := make([]int64, 0)
	err := lps.SQLStore.WithDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		panel, err := getLibraryPanel(session, uid, c.SignedInUser.OrgId)
		if err != nil {
			return err
		}

		var libraryPanelDashboards []libraryPanelDashboard
		session.Table("library_panel_dashboard")
		session.Where("librarypanel_id=?", panel.ID)
		err = session.Find(&libraryPanelDashboards)
		if err != nil {
			return err
		}

		for _, lpd := range libraryPanelDashboards {
			connectedDashboardIDs = append(connectedDashboardIDs, lpd.DashboardID)
		}

		return nil
	})

	return connectedDashboardIDs, err
}

func (lps *LibraryPanelService) getLibraryPanelsForDashboardID(dashboardID int64) (map[string]LibraryPanel, error) {
	libraryPanelMap := make(map[string]LibraryPanel)
	err := lps.SQLStore.WithDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		sql := `SELECT
				lp.id, lp.org_id, lp.folder_id, lp.uid, lp.name, lp.model, lp.created, lp.created_by, lp.updated, lp.updated_by
			FROM
				library_panel_dashboard AS lpd
			INNER JOIN
				library_panel AS lp ON lpd.librarypanel_id = lp.id AND lpd.dashboard_id=?`

		var libraryPanels []LibraryPanel
		sess := session.SQL(sql, dashboardID)
		err := sess.Find(&libraryPanels)
		if err != nil {
			return err
		}

		for _, panel := range libraryPanels {
			libraryPanelMap[panel.UID] = panel
		}

		return nil
	})

	return libraryPanelMap, err
}

// patchLibraryPanel updates a Library Panel.
func (lps *LibraryPanelService) patchLibraryPanel(c *models.ReqContext, cmd patchLibraryPanelCommand, uid string) (LibraryPanelDTO, error) {
	var dto LibraryPanelDTO
	err := lps.SQLStore.WithTransactionalDbSession(context.Background(), func(session *sqlstore.DBSession) error {
		panelInDB, err := getLibraryPanel(session, uid, c.SignedInUser.OrgId)
		if err != nil {
			return err
		}

		var libraryPanel = LibraryPanel{
			ID:        panelInDB.ID,
			OrgID:     c.SignedInUser.OrgId,
			FolderID:  cmd.FolderID,
			UID:       uid,
			Name:      cmd.Name,
			Model:     cmd.Model,
			Created:   panelInDB.Created,
			CreatedBy: panelInDB.CreatedBy,
			Updated:   time.Now(),
			UpdatedBy: c.SignedInUser.UserId,
		}

		if cmd.FolderID == 0 {
			libraryPanel.FolderID = panelInDB.FolderID
		}
		if cmd.Name == "" {
			libraryPanel.Name = panelInDB.Name
		}
		if cmd.Model == nil {
			libraryPanel.Model = panelInDB.Model
		}

		if rowsAffected, err := session.ID(panelInDB.ID).Update(&libraryPanel); err != nil {
			if lps.SQLStore.Dialect.IsUniqueConstraintViolation(err) {
				return errLibraryPanelAlreadyExists
			}
			return err
		} else if rowsAffected != 1 {
			return errLibraryPanelNotFound
		}

		dto = LibraryPanelDTO{
			ID:       libraryPanel.ID,
			OrgID:    libraryPanel.OrgID,
			FolderID: libraryPanel.FolderID,
			UID:      libraryPanel.UID,
			Name:     libraryPanel.Name,
			Model:    libraryPanel.Model,
			Meta: LibraryPanelDTOMeta{
				CanEdit: true,
				Created: libraryPanel.Created,
				Updated: libraryPanel.Updated,
				CreatedBy: LibraryPanelDTOMetaUser{
					ID:        libraryPanel.CreatedBy,
					Name:      panelInDB.CreatedByName,
					AvatarUrl: dtos.GetGravatarUrl(panelInDB.CreatedByEmail),
				},
				UpdatedBy: LibraryPanelDTOMetaUser{
					ID:        libraryPanel.UpdatedBy,
					Name:      c.SignedInUser.Login,
					AvatarUrl: dtos.GetGravatarUrl(c.SignedInUser.Email),
				},
			},
		}

		return nil
	})

	return dto, err
}
