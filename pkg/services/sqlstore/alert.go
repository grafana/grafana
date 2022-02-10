package sqlstore

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

// timeNow makes it possible to test usage of time
var timeNow = time.Now

func (ss *SQLStore) addAlertQueryAndCommandHandlers() {
	bus.AddHandler("sql", ss.HandleAlertsQuery)
	bus.AddHandler("sql", ss.GetAlertById)
	bus.AddHandler("sql", ss.GetAllAlertQueryHandler)
	bus.AddHandler("sql", ss.SetAlertState)
	bus.AddHandler("sql", ss.GetAlertStatesForDashboard)
	bus.AddHandler("sql", ss.PauseAlert)
	bus.AddHandler("sql", ss.PauseAllAlerts)
}

func (ss *SQLStore) GetAlertById(ctx context.Context, query *models.GetAlertByIdQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		alert := models.Alert{}
		has, err := sess.ID(query.Id).Get(&alert)
		if !has {
			return fmt.Errorf("could not find alert")
		}
		if err != nil {
			return err
		}

		query.Result = &alert
		return nil
	})
}

func (ss *SQLStore) GetAllAlertQueryHandler(ctx context.Context, query *models.GetAllAlertsQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		var alerts []*models.Alert
		err := sess.SQL("select * from alert").Find(&alerts)
		if err != nil {
			return err
		}

		query.Result = alerts
		return nil
	})
}

func deleteAlertByIdInternal(alertId int64, reason string, sess *DBSession) error {
	sqlog.Debug("Deleting alert", "id", alertId, "reason", reason)

	if _, err := sess.Exec("DELETE FROM alert WHERE id = ?", alertId); err != nil {
		return err
	}

	if _, err := sess.Exec("DELETE FROM annotation WHERE alert_id = ?", alertId); err != nil {
		return err
	}

	if _, err := sess.Exec("DELETE FROM alert_notification_state WHERE alert_id = ?", alertId); err != nil {
		return err
	}

	if _, err := sess.Exec("DELETE FROM alert_rule_tag WHERE alert_id = ?", alertId); err != nil {
		return err
	}

	return nil
}

func (ss *SQLStore) HandleAlertsQuery(ctx context.Context, query *models.GetAlertsQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		builder := SQLBuilder{}

		builder.Write(`SELECT
		alert.id,
		alert.dashboard_id,
		alert.panel_id,
		alert.name,
		alert.state,
		alert.new_state_date,
		alert.eval_data,
		alert.eval_date,
		alert.execution_error,
		dashboard.uid as dashboard_uid,
		dashboard.slug as dashboard_slug
		FROM alert
		INNER JOIN dashboard on dashboard.id = alert.dashboard_id `)

		builder.Write(`WHERE alert.org_id = ?`, query.OrgId)

		if len(strings.TrimSpace(query.Query)) > 0 {
			builder.Write(" AND alert.name "+dialect.LikeStr()+" ?", "%"+query.Query+"%")
		}

		if len(query.DashboardIDs) > 0 {
			builder.sql.WriteString(` AND alert.dashboard_id IN (?` + strings.Repeat(",?", len(query.DashboardIDs)-1) + `) `)

			for _, dbID := range query.DashboardIDs {
				builder.AddParams(dbID)
			}
		}

		if query.PanelId != 0 {
			builder.Write(` AND alert.panel_id = ?`, query.PanelId)
		}

		if len(query.State) > 0 && query.State[0] != "all" {
			builder.Write(` AND (`)
			for i, v := range query.State {
				if i > 0 {
					builder.Write(" OR ")
				}
				if strings.HasPrefix(v, "not_") {
					builder.Write("state <> ? ")
					v = strings.TrimPrefix(v, "not_")
				} else {
					builder.Write("state = ? ")
				}
				builder.AddParams(v)
			}
			builder.Write(")")
		}

		if query.User.OrgRole != models.ROLE_ADMIN {
			builder.WriteDashboardPermissionFilter(query.User, models.PERMISSION_VIEW)
		}

		builder.Write(" ORDER BY name ASC")

		if query.Limit != 0 {
			builder.Write(dialect.Limit(query.Limit))
		}

		alerts := make([]*models.AlertListItemDTO, 0)
		if err := sess.SQL(builder.GetSQLString(), builder.params...).Find(&alerts); err != nil {
			return err
		}

		for i := range alerts {
			if alerts[i].ExecutionError == " " {
				alerts[i].ExecutionError = ""
			}
		}

		query.Result = alerts
		return nil
	})
}

func deleteAlertDefinition(dashboardId int64, sess *DBSession) error {
	alerts := make([]*models.Alert, 0)
	if err := sess.Where("dashboard_id = ?", dashboardId).Find(&alerts); err != nil {
		return err
	}

	for _, alert := range alerts {
		if err := deleteAlertByIdInternal(alert.Id, "Dashboard deleted", sess); err != nil {
			// If we return an error, the current transaction gets rolled back, so no use
			// trying to delete more
			return err
		}
	}

	return nil
}

func (ss *SQLStore) SaveAlerts(ctx context.Context, dashID int64, alerts []*models.Alert) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		existingAlerts, err := GetAlertsByDashboardId2(dashID, sess)
		if err != nil {
			return err
		}

		if err := updateAlerts(existingAlerts, alerts, sess); err != nil {
			return err
		}

		if err := deleteMissingAlerts(existingAlerts, alerts, sess); err != nil {
			return err
		}

		return nil
	})
}

func updateAlerts(existingAlerts []*models.Alert, alerts []*models.Alert, sess *DBSession) error {
	for _, alert := range alerts {
		update := false
		var alertToUpdate *models.Alert

		for _, k := range existingAlerts {
			if alert.PanelId == k.PanelId {
				update = true
				alert.Id = k.Id
				alertToUpdate = k
				break
			}
		}

		if update {
			if alertToUpdate.ContainsUpdates(alert) {
				alert.Updated = timeNow()
				alert.State = alertToUpdate.State
				sess.MustCols("message", "for")

				_, err := sess.ID(alert.Id).Update(alert)
				if err != nil {
					return err
				}

				sqlog.Debug("Alert updated", "name", alert.Name, "id", alert.Id)
			}
		} else {
			alert.Updated = timeNow()
			alert.Created = timeNow()
			alert.State = models.AlertStateUnknown
			alert.NewStateDate = timeNow()

			_, err := sess.Insert(alert)
			if err != nil {
				return err
			}

			sqlog.Debug("Alert inserted", "name", alert.Name, "id", alert.Id)
		}
		tags := alert.GetTagsFromSettings()
		if _, err := sess.Exec("DELETE FROM alert_rule_tag WHERE alert_id = ?", alert.Id); err != nil {
			return err
		}
		if tags != nil {
			tags, err := EnsureTagsExist(sess, tags)
			if err != nil {
				return err
			}
			for _, tag := range tags {
				if _, err := sess.Exec("INSERT INTO alert_rule_tag (alert_id, tag_id) VALUES(?,?)", alert.Id, tag.Id); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

func deleteMissingAlerts(alerts []*models.Alert, existingAlerts []*models.Alert, sess *DBSession) error {
	for _, missingAlert := range alerts {
		missing := true

		for _, k := range existingAlerts {
			if missingAlert.PanelId == k.PanelId {
				missing = false
				break
			}
		}

		if missing {
			if err := deleteAlertByIdInternal(missingAlert.Id, "Removed from dashboard", sess); err != nil {
				// No use trying to delete more, since we're in a transaction and it will be
				// rolled back on error.
				return err
			}
		}
	}

	return nil
}

func GetAlertsByDashboardId2(dashboardId int64, sess *DBSession) ([]*models.Alert, error) {
	alerts := make([]*models.Alert, 0)
	err := sess.Where("dashboard_id = ?", dashboardId).Find(&alerts)

	if err != nil {
		return []*models.Alert{}, err
	}

	return alerts, nil
}

func (ss *SQLStore) SetAlertState(ctx context.Context, cmd *models.SetAlertStateCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		alert := models.Alert{}

		if has, err := sess.ID(cmd.AlertId).Get(&alert); err != nil {
			return err
		} else if !has {
			return fmt.Errorf("could not find alert")
		}

		if alert.State == models.AlertStatePaused {
			return models.ErrCannotChangeStateOnPausedAlert
		}

		if alert.State == cmd.State {
			return models.ErrRequiresNewState
		}

		alert.State = cmd.State
		alert.StateChanges++
		alert.NewStateDate = timeNow()
		alert.EvalData = cmd.EvalData

		if cmd.Error == "" {
			alert.ExecutionError = " " // without this space, xorm skips updating this field
		} else {
			alert.ExecutionError = cmd.Error
		}

		_, err := sess.ID(alert.Id).Update(&alert)
		if err != nil {
			return err
		}

		cmd.Result = alert
		return nil
	})
}

func (ss *SQLStore) PauseAlert(ctx context.Context, cmd *models.PauseAlertCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		if len(cmd.AlertIds) == 0 {
			return fmt.Errorf("command contains no alertids")
		}

		var buffer bytes.Buffer
		params := make([]interface{}, 0)

		buffer.WriteString(`UPDATE alert SET state = ?, new_state_date = ?`)
		if cmd.Paused {
			params = append(params, string(models.AlertStatePaused))
			params = append(params, timeNow().UTC())
		} else {
			params = append(params, string(models.AlertStateUnknown))
			params = append(params, timeNow().UTC())
		}

		buffer.WriteString(` WHERE id IN (?` + strings.Repeat(",?", len(cmd.AlertIds)-1) + `)`)
		for _, v := range cmd.AlertIds {
			params = append(params, v)
		}

		sqlOrArgs := append([]interface{}{buffer.String()}, params...)

		res, err := sess.Exec(sqlOrArgs...)
		if err != nil {
			return err
		}
		cmd.ResultCount, _ = res.RowsAffected()
		return nil
	})
}

func (ss *SQLStore) PauseAllAlerts(ctx context.Context, cmd *models.PauseAllAlertCommand) error {
	return ss.WithTransactionalDbSession(ctx, func(sess *DBSession) error {
		var newState string
		if cmd.Paused {
			newState = string(models.AlertStatePaused)
		} else {
			newState = string(models.AlertStateUnknown)
		}

		res, err := sess.Exec(`UPDATE alert SET state = ?, new_state_date = ?`, newState, timeNow().UTC())
		if err != nil {
			return err
		}
		cmd.ResultCount, _ = res.RowsAffected()
		return nil
	})
}

func (ss *SQLStore) GetAlertStatesForDashboard(ctx context.Context, query *models.GetAlertStatesForDashboardQuery) error {
	return ss.WithDbSession(ctx, func(sess *DBSession) error {
		var rawSQL = `SELECT
	                id,
	                dashboard_id,
	                panel_id,
	                state,
	                new_state_date
	                FROM alert
	                WHERE org_id = ? AND dashboard_id = ?`

		query.Result = make([]*models.AlertStateInfoDTO, 0)
		err := sess.SQL(rawSQL, query.OrgId, query.DashboardId).Find(&query.Result)

		return err
	})
}
