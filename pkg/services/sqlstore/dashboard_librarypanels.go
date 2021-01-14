package sqlstore

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetLibraryPanelsForDashboardID)
}

func GetLibraryPanelsForDashboardID(query *models.GetLibraryPanelsQuery) error {
	sql := `SELECT
				lp.id, lp.org_id, lp.folder_id, lp.uid, lp.name, lp.model, lp.created, lp.created_by, lp.updated, updated_by
			FROM
				library_panel_dashboard lpd
			INNER JOIN
				library_panel lp ON lpd.librarypanel_id = lp.id AND lpd.dashboard_id=?`

	libraryPanels := make([]models.LibraryPanel, 0)
	sess := x.SQL(sql, query.DashboardId)
	err := sess.Find(&libraryPanels)
	if err != nil {
		return err
	}

	libraryPanelMap := make(map[string]models.LibraryPanel)
	for _, panel := range libraryPanels {
		libraryPanelMap[panel.UID] = panel
	}

	query.Result = libraryPanelMap

	return nil
}
