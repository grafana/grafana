package migrations

import (
	"encoding/json"
	"strconv"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addDashboardPanelMaxDataPointsAsIntegerMigration(mg *migrator.Migrator) {
	mg.AddMigration("update maxDataPoints value type as integer in dashboard panels", &MakePanelMaxDataPointsAsIntegerMigration{})
}

type MakePanelMaxDataPointsAsIntegerMigration struct {
	migrator.MigrationBase
}

func (m *MakePanelMaxDataPointsAsIntegerMigration) SQL(dialect migrator.Dialect) string {
	return "code migration"
}

type DashboardDataDTO struct {
	Id   int64
	Data string
}

func (m *MakePanelMaxDataPointsAsIntegerMigration) Exec(sess *xorm.Session, mg *migrator.Migrator) error {
	dashboardDataDTOs := make([]*DashboardDataDTO, 0)

	err := sess.SQL(`SELECT id, data FROM dashboard WHERE uid="f0532a5b-a3d9-43b6-8a4b-dab0ccf8066a"`).Find(&dashboardDataDTOs)
	if err != nil {
		return err
	}

	for _, dashboardDataDTO := range dashboardDataDTOs {
		updated := false
		var err error
		var dataJson map[string]json.RawMessage
		err = json.Unmarshal([]byte(dashboardDataDTO.Data), &dataJson)
		if err != nil {
			return err
		}

		var ok bool
		var panelsData []byte
		if panelsData, ok = dataJson["panels"]; !ok {
			// No panel found in dashboard
			continue
		}

		var panelsJson []map[string]any
		err = json.Unmarshal(panelsData, &panelsJson)
		if err != nil {
			// Cannot unmarshall panels json
			continue
		}

		for _, panel := range panelsJson {
			var maxDataPoints any
			if maxDataPoints, ok = panel["maxDataPoints"]; !ok {
				// maxDataPoints field does not exist in panel
				continue
			}

			if s, ok := (maxDataPoints).(string); ok {
				mdp, err := strconv.Atoi(s)
				if err != nil {
					// cannot convert to integer
					continue
				}
				updated = true
				panel["maxDataPoints"] = mdp
			}
		}

		// Run update only when something is updated
		if updated {
			updatedPanelJson, err := json.Marshal(panelsJson)
			if err != nil {
				// panel marshalling error
				continue
			}

			dataJson["panels"] = updatedPanelJson

			updatedDataJson, err := json.Marshal(dataJson)
			if err != nil {
				// data marshalling error
				continue
			}

			_, err = sess.Exec("UPDATE dashboard set data = ? where id = ?", updatedDataJson, dashboardDataDTO.Id)
			if err != nil {
				// update failed. Continue to the next panel
				continue
			}
		}
	}

	return nil
}
