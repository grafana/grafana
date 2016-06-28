package sqlstore

import (
	"bytes"
	"fmt"
	"strings"
	"time"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", SaveAlerts)
	bus.AddHandler("sql", HandleAlertsQuery)
	bus.AddHandler("sql", GetAlertById)
	bus.AddHandler("sql", DeleteAlertById)
	bus.AddHandler("sql", GetAllAlertQueryHandler)
	//bus.AddHandler("sql", HeartBeat)
}

/*
func HeartBeat(query *m.HeartBeatCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		now := time.Now().Sub(0, 0, 0, 5)
		activeTime := time.Now().Sub(0, 0, 0, 5)
		ownHeartbeats := make([]m.HeartBeat, 0)
		err := x.Where("server_id = ?", query.ServerId).Find(&ownHeartbeats)

		if err != nil {
			return err
		}

		if (len(ownHeartbeats)) > 0 && ownHeartbeats[0].Updated > activeTime {
			//update
			x.Insert(&m.HeartBeat{ServerId: query.ServerId, Created: now, Updated: now})
		} else {
			thisServer := ownHeartbeats[0]
			thisServer.Updated = now
			x.Id(thisServer.Id).Update(&thisServer)
		}

		activeServers := make([]m.HeartBeat, 0)
		err = x.Where("server_id = ? and updated > ", query.ServerId, now.String()).OrderBy("id").Find(&activeServers)

		if err != nil {
			return err
		}

		for i, pos := range activeServers {
			if pos.ServerId == query.ServerId {
				query.Result = &m.AlertingClusterInfo{
					ClusterSize:    len(activeServers),
					UptimePosition: i,
				}
				return nil
			}
		}

		return nil
	})
}
*/

func GetAlertById(query *m.GetAlertByIdQuery) error {
	alert := m.Alert{}
	has, err := x.Id(query.Id).Get(&alert)
	if !has {
		return fmt.Errorf("could not find alert")
	}
	if err != nil {
		return err
	}

	query.Result = &alert
	return nil
}

func GetAllAlertQueryHandler(query *m.GetAllAlertsQuery) error {
	var alerts []*m.Alert
	err := x.Sql("select * from alert").Find(&alerts)
	if err != nil {
		return err
	}

	query.Result = alerts
	return nil
}

func DeleteAlertById(cmd *m.DeleteAlertCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		if _, err := sess.Exec("DELETE FROM alert WHERE id = ?", cmd.AlertId); err != nil {
			return err
		}

		return nil
	})
}

func HandleAlertsQuery(query *m.GetAlertsQuery) error {
	var sql bytes.Buffer
	params := make([]interface{}, 0)

	sql.WriteString(`SELECT *
						from alert
						`)

	sql.WriteString(`WHERE org_id = ?`)
	params = append(params, query.OrgId)

	if query.DashboardId != 0 {
		sql.WriteString(` AND dashboard_id = ?`)
		params = append(params, query.DashboardId)
	}

	if query.PanelId != 0 {
		sql.WriteString(` AND panel_id = ?`)
		params = append(params, query.PanelId)
	}

	if len(query.State) > 0 {
		sql.WriteString(` AND (`)
		for i, v := range query.State {
			if i > 0 {
				sql.WriteString(" OR ")
			}
			sql.WriteString("state = ? ")
			params = append(params, strings.ToUpper(v))
		}
		sql.WriteString(")")
	}

	alerts := make([]*m.Alert, 0)
	if err := x.Sql(sql.String(), params...).Find(&alerts); err != nil {
		return err
	}

	query.Result = alerts
	return nil
}

func DeleteAlertDefinition(dashboardId int64, sess *xorm.Session) error {
	alerts := make([]*m.Alert, 0)
	sess.Where("dashboard_id = ?", dashboardId).Find(&alerts)

	for _, alert := range alerts {
		_, err := sess.Exec("DELETE FROM alert WHERE id = ? ", alert.Id)
		if err != nil {
			return err
		}

		sqlog.Debug("Alert deleted (due to dashboard deletion)", "name", alert.Name, "id", alert.Id)

		cmd := &m.CreateAlertChangeCommand{
			Type:             "DELETED",
			UpdatedBy:        1,
			AlertId:          alert.Id,
			OrgId:            alert.OrgId,
			NewAlertSettings: alert.Settings,
		}
		if err := SaveAlertChange(cmd, sess); err != nil {
			return err
		}
	}

	return nil
}

func SaveAlerts(cmd *m.SaveAlertsCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		alerts, err := GetAlertsByDashboardId2(cmd.DashboardId, sess)
		if err != nil {
			return err
		}

		upsertAlerts(alerts, cmd, sess)
		deleteMissingAlerts(alerts, cmd, sess)

		return nil
	})
}

func upsertAlerts(alerts []*m.Alert, cmd *m.SaveAlertsCommand, sess *xorm.Session) error {
	for _, alert := range cmd.Alerts {
		update := false
		var alertToUpdate *m.Alert

		for _, k := range alerts {
			if alert.PanelId == k.PanelId {
				update = true
				alert.Id = k.Id
				alertToUpdate = k
				break
			}
		}

		if update {
			if alertToUpdate.ContainsUpdates(alert) {
				alert.Updated = time.Now()
				alert.State = alertToUpdate.State
				_, err := sess.Id(alert.Id).Update(alert)
				if err != nil {
					return err
				}

				sqlog.Debug("Alert updated", "name", alert.Name, "id", alert.Id)
				SaveAlertChange(&m.CreateAlertChangeCommand{
					OrgId:            alert.OrgId,
					AlertId:          alert.Id,
					NewAlertSettings: alert.Settings,
					UpdatedBy:        cmd.UserId,
					Type:             "UPDATED",
				}, sess)
			}

		} else {
			alert.Updated = time.Now()
			alert.Created = time.Now()
			alert.State = "OK"
			_, err := sess.Insert(alert)
			if err != nil {
				return err
			}

			sqlog.Debug("Alert inserted", "name", alert.Name, "id", alert.Id)
			SaveAlertChange(&m.CreateAlertChangeCommand{
				OrgId:            alert.OrgId,
				AlertId:          alert.Id,
				NewAlertSettings: alert.Settings,
				UpdatedBy:        cmd.UserId,
				Type:             "CREATED",
			}, sess)
		}
	}

	return nil
}

func deleteMissingAlerts(alerts []*m.Alert, cmd *m.SaveAlertsCommand, sess *xorm.Session) error {
	for _, missingAlert := range alerts {
		missing := true

		for _, k := range cmd.Alerts {
			if missingAlert.PanelId == k.PanelId {
				missing = false
				break
			}
		}

		if missing {
			_, err := sess.Exec("DELETE FROM alert WHERE id = ?", missingAlert.Id)
			if err != nil {
				return err
			}

			sqlog.Debug("Alert deleted", "name", missingAlert.Name, "id", missingAlert.Id)

			SaveAlertChange(&m.CreateAlertChangeCommand{
				OrgId:            missingAlert.OrgId,
				AlertId:          missingAlert.Id,
				NewAlertSettings: missingAlert.Settings,
				UpdatedBy:        cmd.UserId,
				Type:             "DELETED",
			}, sess)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func GetAlertsByDashboardId2(dashboardId int64, sess *xorm.Session) ([]*m.Alert, error) {
	alerts := make([]*m.Alert, 0)
	err := sess.Where("dashboard_id = ?", dashboardId).Find(&alerts)

	if err != nil {
		return []*m.Alert{}, err
	}

	return alerts, nil
}
