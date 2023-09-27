package alerting

import (
	"bytes"
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	alertmodels "github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/setting"
)

// AlertStore is a subset of SQLStore API to satisfy the needs of the alerting service.
// A subset is needed to make it easier to mock during the tests.
type AlertStore interface {
	GetAlertById(context.Context, *alertmodels.GetAlertByIdQuery) (*alertmodels.Alert, error)
	GetAllAlertQueryHandler(context.Context, *alertmodels.GetAllAlertsQuery) ([]*alertmodels.Alert, error)
	GetAlertStatesForDashboard(context.Context, *alertmodels.GetAlertStatesForDashboardQuery) ([]*alertmodels.AlertStateInfoDTO, error)
	HandleAlertsQuery(context.Context, *alertmodels.GetAlertsQuery) ([]*alertmodels.AlertListItemDTO, error)
	SetAlertNotificationStateToCompleteCommand(context.Context, *alertmodels.SetAlertNotificationStateToCompleteCommand) error
	SetAlertNotificationStateToPendingCommand(context.Context, *alertmodels.SetAlertNotificationStateToPendingCommand) error
	GetAlertNotificationUidWithId(context.Context, *alertmodels.GetAlertNotificationUidQuery) (string, error)
	GetAlertNotificationsWithUidToSend(context.Context, *alertmodels.GetAlertNotificationsWithUidToSendQuery) ([]*alertmodels.AlertNotification, error)
	GetOrCreateAlertNotificationState(context.Context, *alertmodels.GetOrCreateNotificationStateQuery) (*alertmodels.AlertNotificationState, error)
	SetAlertState(context.Context, *alertmodels.SetAlertStateCommand) (alertmodels.Alert, error)
	PauseAlert(context.Context, *alertmodels.PauseAlertCommand) error
	PauseAllAlerts(context.Context, *alertmodels.PauseAllAlertCommand) error
}

type sqlStore struct {
	db         db.DB
	cache      *localcache.CacheService
	log        *log.ConcreteLogger
	cfg        *setting.Cfg
	tagService tag.Service
	features   featuremgmt.FeatureToggles
}

func ProvideAlertStore(
	db db.DB,
	cacheService *localcache.CacheService, cfg *setting.Cfg, tagService tag.Service, features featuremgmt.FeatureToggles) AlertStore {
	return &sqlStore{
		db:         db,
		cache:      cacheService,
		log:        log.New("alerting.store"),
		cfg:        cfg,
		tagService: tagService,
		features:   features,
	}
}

func (ss *sqlStore) GetAlertById(ctx context.Context, query *alertmodels.GetAlertByIdQuery) (res *alertmodels.Alert, err error) {
	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		alert := alertmodels.Alert{}
		has, err := sess.ID(query.ID).Get(&alert)
		if !has {
			return fmt.Errorf("could not find alert")
		}
		if err != nil {
			return err
		}

		res = &alert
		return nil
	})
	return res, err
}

func (ss *sqlStore) GetAllAlertQueryHandler(ctx context.Context, query *alertmodels.GetAllAlertsQuery) (res []*alertmodels.Alert, err error) {
	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var alerts []*alertmodels.Alert
		err := sess.SQL("select * from alert").Find(&alerts)
		if err != nil {
			return err
		}

		res = alerts
		return nil
	})
	return res, err
}

func deleteAlertByIdInternal(alertId int64, reason string, sess *db.Session, log *log.ConcreteLogger) error {
	log.Debug("Deleting alert", "id", alertId, "reason", reason)

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

func (ss *sqlStore) HandleAlertsQuery(ctx context.Context, query *alertmodels.GetAlertsQuery) (res []*alertmodels.AlertListItemDTO, err error) {
	recursiveQueriesAreSupported, err := ss.db.RecursiveQueriesAreSupported()
	if err != nil {
		return res, err
	}

	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		builder := db.NewSqlBuilder(ss.cfg, ss.features, ss.db.GetDialect(), recursiveQueriesAreSupported)

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

		builder.Write(`WHERE alert.org_id = ?`, query.OrgID)

		if len(strings.TrimSpace(query.Query)) > 0 {
			builder.Write(" AND alert.name "+ss.db.GetDialect().LikeStr()+" ?", "%"+query.Query+"%")
		}

		if len(query.DashboardIDs) > 0 {
			builder.Write(` AND alert.dashboard_id IN (?` + strings.Repeat(",?", len(query.DashboardIDs)-1) + `) `)

			for _, dbID := range query.DashboardIDs {
				builder.AddParams(dbID)
			}
		}

		if query.PanelID != 0 {
			builder.Write(` AND alert.panel_id = ?`, query.PanelID)
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

		builder.WriteDashboardPermissionFilter(query.User, dashboards.PERMISSION_VIEW, "")

		builder.Write(" ORDER BY name ASC")

		if query.Limit != 0 {
			builder.Write(ss.db.GetDialect().Limit(query.Limit))
		}

		alerts := make([]*alertmodels.AlertListItemDTO, 0)
		if err := sess.SQL(builder.GetSQLString(), builder.GetParams()...).Find(&alerts); err != nil {
			return err
		}

		for i := range alerts {
			if alerts[i].ExecutionError == " " {
				alerts[i].ExecutionError = ""
			}
		}

		res = alerts
		return nil
	})
	return res, err
}

func (ss *sqlStore) SaveAlerts(ctx context.Context, dashID int64, alerts []*alertmodels.Alert) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		existingAlerts, err := GetAlertsByDashboardId2(dashID, sess)
		if err != nil {
			return err
		}

		if err := ss.UpdateAlerts(ctx, existingAlerts, alerts, sess, ss.log); err != nil {
			return err
		}

		if err := deleteMissingAlerts(existingAlerts, alerts, sess, ss.log); err != nil {
			return err
		}

		return nil
	})
}

func (ss *sqlStore) UpdateAlerts(ctx context.Context, existingAlerts []*alertmodels.Alert, alerts []*alertmodels.Alert, sess *db.Session, log *log.ConcreteLogger) error {
	for _, alert := range alerts {
		update := false
		var alertToUpdate *alertmodels.Alert

		for _, k := range existingAlerts {
			if alert.PanelID == k.PanelID {
				update = true
				alert.ID = k.ID
				alertToUpdate = k
				break
			}
		}

		if update {
			if alertToUpdate.ContainsUpdates(alert) {
				alert.Updated = timeNow()
				alert.State = alertToUpdate.State
				sess.MustCols("message", "for")

				_, err := sess.ID(alert.ID).Update(alert)
				if err != nil {
					return err
				}

				log.Debug("Alert updated", "name", alert.Name, "id", alert.ID)
			}
		} else {
			alert.Updated = timeNow()
			alert.Created = timeNow()
			alert.State = alertmodels.AlertStateUnknown
			alert.NewStateDate = timeNow()

			_, err := sess.Insert(alert)
			if err != nil {
				return err
			}

			log.Debug("Alert inserted", "name", alert.Name, "id", alert.ID)
		}
		tags := alert.GetTagsFromSettings()
		if _, err := sess.Exec("DELETE FROM alert_rule_tag WHERE alert_id = ?", alert.ID); err != nil {
			return err
		}
		if tags != nil {
			tags, err := ss.tagService.EnsureTagsExist(ctx, tags)
			if err != nil {
				return err
			}
			for _, tag := range tags {
				if _, err := sess.Exec("INSERT INTO alert_rule_tag (alert_id, tag_id) VALUES(?,?)", alert.ID, tag.Id); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

func deleteMissingAlerts(alerts []*alertmodels.Alert, existingAlerts []*alertmodels.Alert, sess *db.Session, log *log.ConcreteLogger) error {
	for _, missingAlert := range alerts {
		missing := true

		for _, k := range existingAlerts {
			if missingAlert.PanelID == k.PanelID {
				missing = false
				break
			}
		}

		if missing {
			if err := deleteAlertByIdInternal(missingAlert.ID, "Removed from dashboard", sess, log); err != nil {
				// No use trying to delete more, since we're in a transaction and it will be
				// rolled back on error.
				return err
			}
		}
	}

	return nil
}

func GetAlertsByDashboardId2(dashboardId int64, sess *db.Session) ([]*alertmodels.Alert, error) {
	alerts := make([]*alertmodels.Alert, 0)
	err := sess.Where("dashboard_id = ?", dashboardId).Find(&alerts)

	if err != nil {
		return []*alertmodels.Alert{}, err
	}

	return alerts, nil
}

func (ss *sqlStore) SetAlertState(ctx context.Context, cmd *alertmodels.SetAlertStateCommand) (res alertmodels.Alert, err error) {
	err = ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		alert := alertmodels.Alert{}

		if has, err := sess.ID(cmd.AlertID).Get(&alert); err != nil {
			return err
		} else if !has {
			return fmt.Errorf("could not find alert")
		}

		if alert.State == alertmodels.AlertStatePaused {
			return alertmodels.ErrCannotChangeStateOnPausedAlert
		}

		if alert.State == cmd.State {
			return alertmodels.ErrRequiresNewState
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

		_, err := sess.ID(alert.ID).Update(&alert)
		if err != nil {
			return err
		}

		res = alert
		return nil
	})
	return res, err
}

func (ss *sqlStore) PauseAlert(ctx context.Context, cmd *alertmodels.PauseAlertCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if len(cmd.AlertIDs) == 0 {
			return fmt.Errorf("command contains no alertids")
		}

		var buffer bytes.Buffer
		params := make([]interface{}, 0)

		buffer.WriteString(`UPDATE alert SET state = ?, new_state_date = ?`)
		if cmd.Paused {
			params = append(params, string(alertmodels.AlertStatePaused))
			params = append(params, timeNow().UTC())
		} else {
			params = append(params, string(alertmodels.AlertStateUnknown))
			params = append(params, timeNow().UTC())
		}

		buffer.WriteString(` WHERE id IN (?` + strings.Repeat(",?", len(cmd.AlertIDs)-1) + `)`)
		for _, v := range cmd.AlertIDs {
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

func (ss *sqlStore) PauseAllAlerts(ctx context.Context, cmd *alertmodels.PauseAllAlertCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var newState string
		if cmd.Paused {
			newState = string(alertmodels.AlertStatePaused)
		} else {
			newState = string(alertmodels.AlertStateUnknown)
		}

		res, err := sess.Exec(`UPDATE alert SET state = ?, new_state_date = ?`, newState, timeNow().UTC())
		if err != nil {
			return err
		}
		cmd.ResultCount, _ = res.RowsAffected()
		return nil
	})
}

func (ss *sqlStore) GetAlertStatesForDashboard(ctx context.Context, query *alertmodels.GetAlertStatesForDashboardQuery) (res []*alertmodels.AlertStateInfoDTO, err error) {
	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var rawSQL = `SELECT
	                id,
	                dashboard_id,
	                panel_id,
	                state,
	                new_state_date
	                FROM alert
	                WHERE org_id = ? AND dashboard_id = ?`

		res = make([]*alertmodels.AlertStateInfoDTO, 0)
		return sess.SQL(rawSQL, query.OrgID, query.DashboardID).Find(&res)
	})
	return res, err
}
