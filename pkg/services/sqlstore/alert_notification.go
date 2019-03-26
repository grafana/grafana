package sqlstore

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func init() {
	bus.AddHandler("sql", GetAlertNotifications)
	bus.AddHandler("sql", CreateAlertNotificationCommand)
	bus.AddHandler("sql", UpdateAlertNotification)
	bus.AddHandler("sql", DeleteAlertNotification)
	bus.AddHandler("sql", GetAllAlertNotifications)
	bus.AddHandlerCtx("sql", GetOrCreateAlertNotificationState)
	bus.AddHandlerCtx("sql", SetAlertNotificationStateToCompleteCommand)
	bus.AddHandlerCtx("sql", SetAlertNotificationStateToPendingCommand)

	bus.AddHandler("sql", GetAlertNotificationsWithUid)
	bus.AddHandler("sql", UpdateAlertNotificationWithUid)
	bus.AddHandler("sql", DeleteAlertNotificationWithUid)
	bus.AddHandler("sql", GetAlertNotificationsWithUidToSend)
}

func DeleteAlertNotification(cmd *m.DeleteAlertNotificationCommand) error {
	return inTransaction(func(sess *DBSession) error {
		sql := "DELETE FROM alert_notification WHERE alert_notification.org_id = ? AND alert_notification.id = ?"
		if _, err := sess.Exec(sql, cmd.OrgId, cmd.Id); err != nil {
			return err
		}

		if _, err := sess.Exec("DELETE FROM alert_notification_state WHERE alert_notification_state.org_id = ? AND alert_notification_state.notifier_id = ?", cmd.OrgId, cmd.Id); err != nil {
			return err
		}

		return nil
	})
}

func DeleteAlertNotificationWithUid(cmd *m.DeleteAlertNotificationWithUidCommand) error {
	existingNotification := &m.GetAlertNotificationsWithUidQuery{OrgId: cmd.OrgId, Uid: cmd.Uid}
	if err := getAlertNotificationWithUidInternal(existingNotification, newSession()); err != nil {
		return err
	}

	if existingNotification.Result != nil {
		deleteCommand := &m.DeleteAlertNotificationCommand{
			Id:    existingNotification.Result.Id,
			OrgId: existingNotification.Result.OrgId,
		}
		if err := bus.Dispatch(deleteCommand); err != nil {
			return err
		}
	}

	return nil
}

func GetAlertNotifications(query *m.GetAlertNotificationsQuery) error {
	return getAlertNotificationInternal(query, newSession())
}

func GetAlertNotificationsWithUid(query *m.GetAlertNotificationsWithUidQuery) error {
	return getAlertNotificationWithUidInternal(query, newSession())
}

func GetAllAlertNotifications(query *m.GetAllAlertNotificationsQuery) error {
	results := make([]*m.AlertNotification, 0)
	if err := x.Where("org_id = ?", query.OrgId).Find(&results); err != nil {
		return err
	}

	query.Result = results
	return nil
}

func GetAlertNotificationsWithUidToSend(query *m.GetAlertNotificationsWithUidToSendQuery) error {
	var sql bytes.Buffer
	params := make([]interface{}, 0)

	sql.WriteString(`SELECT
										alert_notification.id,
										alert_notification.uid,
										alert_notification.org_id,
										alert_notification.name,
										alert_notification.type,
										alert_notification.created,
										alert_notification.updated,
										alert_notification.settings,
										alert_notification.is_default,
										alert_notification.disable_resolve_message,
										alert_notification.send_reminder,
										alert_notification.frequency
										FROM alert_notification
	  							`)

	sql.WriteString(` WHERE alert_notification.org_id = ?`)
	params = append(params, query.OrgId)

	sql.WriteString(` AND ((alert_notification.is_default = ?)`)
	params = append(params, dialect.BooleanStr(true))

	if len(query.Uids) > 0 {
		sql.WriteString(` OR alert_notification.uid IN (?` + strings.Repeat(",?", len(query.Uids)-1) + ")")
		for _, v := range query.Uids {
			params = append(params, v)
		}
	}
	sql.WriteString(`)`)

	results := make([]*m.AlertNotification, 0)
	if err := x.SQL(sql.String(), params...).Find(&results); err != nil {
		return err
	}

	query.Result = results
	return nil
}

func getAlertNotificationInternal(query *m.GetAlertNotificationsQuery, sess *DBSession) error {
	var sql bytes.Buffer
	params := make([]interface{}, 0)

	sql.WriteString(`SELECT
										alert_notification.id,
										alert_notification.uid,
										alert_notification.org_id,
										alert_notification.name,
										alert_notification.type,
										alert_notification.created,
										alert_notification.updated,
										alert_notification.settings,
										alert_notification.is_default,
										alert_notification.disable_resolve_message,
										alert_notification.send_reminder,
										alert_notification.frequency
										FROM alert_notification
	  							`)

	sql.WriteString(` WHERE alert_notification.org_id = ?`)
	params = append(params, query.OrgId)

	if query.Name != "" || query.Id != 0 {
		if query.Name != "" {
			sql.WriteString(` AND alert_notification.name = ?`)
			params = append(params, query.Name)
		}

		if query.Id != 0 {
			sql.WriteString(` AND alert_notification.id = ?`)
			params = append(params, query.Id)
		}
	}

	results := make([]*m.AlertNotification, 0)
	if err := sess.SQL(sql.String(), params...).Find(&results); err != nil {
		return err
	}

	if len(results) == 0 {
		query.Result = nil
	} else {
		query.Result = results[0]
	}

	return nil
}

func getAlertNotificationWithUidInternal(query *m.GetAlertNotificationsWithUidQuery, sess *DBSession) error {
	var sql bytes.Buffer
	params := make([]interface{}, 0)

	sql.WriteString(`SELECT
										alert_notification.id,
										alert_notification.uid,
										alert_notification.org_id,
										alert_notification.name,
										alert_notification.type,
										alert_notification.created,
										alert_notification.updated,
										alert_notification.settings,
										alert_notification.is_default,
										alert_notification.disable_resolve_message,
										alert_notification.send_reminder,
										alert_notification.frequency
										FROM alert_notification
	  							`)

	sql.WriteString(` WHERE alert_notification.org_id = ? AND alert_notification.uid = ?`)
	params = append(params, query.OrgId, query.Uid)

	results := make([]*m.AlertNotification, 0)
	if err := sess.SQL(sql.String(), params...).Find(&results); err != nil {
		return err
	}

	if len(results) == 0 {
		query.Result = nil
	} else {
		query.Result = results[0]
	}

	return nil
}

func CreateAlertNotificationCommand(cmd *m.CreateAlertNotificationCommand) error {
	return inTransaction(func(sess *DBSession) error {
		if cmd.Uid == "" {
			if uid, uidGenerationErr := generateNewAlertNotificationUid(sess, cmd.OrgId); uidGenerationErr != nil {
				return uidGenerationErr
			} else {
				cmd.Uid = uid
			}
		}
		existingQuery := &m.GetAlertNotificationsWithUidQuery{OrgId: cmd.OrgId, Uid: cmd.Uid}
		err := getAlertNotificationWithUidInternal(existingQuery, sess)

		if err != nil {
			return err
		}

		if existingQuery.Result != nil {
			return fmt.Errorf("Alert notification uid %s already exists", cmd.Uid)
		}

		// check if name exists
		sameNameQuery := &m.GetAlertNotificationsQuery{OrgId: cmd.OrgId, Name: cmd.Name}
		if err := getAlertNotificationInternal(sameNameQuery, sess); err != nil {
			return err
		}

		if sameNameQuery.Result != nil {
			return fmt.Errorf("Alert notification name %s already exists", cmd.Name)
		}

		var frequency time.Duration
		if cmd.SendReminder {
			if cmd.Frequency == "" {
				return m.ErrNotificationFrequencyNotFound
			}

			frequency, err = time.ParseDuration(cmd.Frequency)
			if err != nil {
				return err
			}
		}

		alertNotification := &m.AlertNotification{
			Uid:                   cmd.Uid,
			OrgId:                 cmd.OrgId,
			Name:                  cmd.Name,
			Type:                  cmd.Type,
			Settings:              cmd.Settings,
			SendReminder:          cmd.SendReminder,
			DisableResolveMessage: cmd.DisableResolveMessage,
			Frequency:             frequency,
			Created:               time.Now(),
			Updated:               time.Now(),
			IsDefault:             cmd.IsDefault,
		}

		if _, err = sess.MustCols("send_reminder").Insert(alertNotification); err != nil {
			return err
		}

		cmd.Result = alertNotification
		return nil
	})
}

func generateNewAlertNotificationUid(sess *DBSession, orgId int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()
		exists, err := sess.Where("org_id=? AND uid=?", orgId, uid).Get(&m.AlertNotification{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", m.ErrAlertNotificationFailedGenerateUniqueUid
}

func UpdateAlertNotification(cmd *m.UpdateAlertNotificationCommand) error {
	return inTransaction(func(sess *DBSession) (err error) {
		current := m.AlertNotification{}

		if _, err = sess.ID(cmd.Id).Get(&current); err != nil {
			return err
		}

		// check if name exists
		sameNameQuery := &m.GetAlertNotificationsQuery{OrgId: cmd.OrgId, Name: cmd.Name}
		if err := getAlertNotificationInternal(sameNameQuery, sess); err != nil {
			return err
		}

		if sameNameQuery.Result != nil && sameNameQuery.Result.Id != current.Id {
			return fmt.Errorf("Alert notification name %s already exists", cmd.Name)
		}

		current.Updated = time.Now()
		current.Settings = cmd.Settings
		current.Name = cmd.Name
		current.Type = cmd.Type
		current.IsDefault = cmd.IsDefault
		current.SendReminder = cmd.SendReminder
		current.DisableResolveMessage = cmd.DisableResolveMessage

		if current.SendReminder {
			if cmd.Frequency == "" {
				return m.ErrNotificationFrequencyNotFound
			}

			frequency, err := time.ParseDuration(cmd.Frequency)
			if err != nil {
				return err
			}

			current.Frequency = frequency
		}

		sess.UseBool("is_default", "send_reminder", "disable_resolve_message")

		if affected, err := sess.ID(cmd.Id).Update(current); err != nil {
			return err
		} else if affected == 0 {
			return fmt.Errorf("Could not update alert notification")
		}

		cmd.Result = &current
		return nil
	})
}

func UpdateAlertNotificationWithUid(cmd *m.UpdateAlertNotificationWithUidCommand) error {
	getAlertNotificationWithUidQuery := &m.GetAlertNotificationsWithUidQuery{OrgId: cmd.OrgId, Uid: cmd.Uid}

	if err := getAlertNotificationWithUidInternal(getAlertNotificationWithUidQuery, newSession()); err != nil {
		return err
	}

	current := getAlertNotificationWithUidQuery.Result

	if current == nil {
		return fmt.Errorf("Cannot update, alert notification uid %s doesn't exist", cmd.Uid)
	}

	updateNotification := &m.UpdateAlertNotificationCommand{
		Id:                    current.Id,
		Name:                  cmd.Name,
		Type:                  cmd.Type,
		SendReminder:          cmd.SendReminder,
		DisableResolveMessage: cmd.DisableResolveMessage,
		Frequency:             cmd.Frequency,
		IsDefault:             cmd.IsDefault,
		Settings:              cmd.Settings,

		OrgId: cmd.OrgId,
	}

	if err := bus.Dispatch(updateNotification); err != nil {
		return err
	}

	return nil
}

func SetAlertNotificationStateToCompleteCommand(ctx context.Context, cmd *m.SetAlertNotificationStateToCompleteCommand) error {
	return inTransactionCtx(ctx, func(sess *DBSession) error {
		version := cmd.Version
		var current m.AlertNotificationState
		sess.ID(cmd.Id).Get(&current)

		newVersion := cmd.Version + 1

		sql := `UPDATE alert_notification_state SET
			state = ?,
			version = ?,
			updated_at = ?
		WHERE
			id = ?`

		_, err := sess.Exec(sql, m.AlertNotificationStateCompleted, newVersion, timeNow().Unix(), cmd.Id)

		if err != nil {
			return err
		}

		if current.Version != version {
			sqlog.Error("notification state out of sync. the notification is marked as complete but has been modified between set as pending and completion.", "notifierId", current.NotifierId)
		}

		return nil
	})
}

func SetAlertNotificationStateToPendingCommand(ctx context.Context, cmd *m.SetAlertNotificationStateToPendingCommand) error {
	return withDbSession(ctx, func(sess *DBSession) error {
		newVersion := cmd.Version + 1
		sql := `UPDATE alert_notification_state SET
			state = ?,
			version = ?,
			updated_at = ?,
			alert_rule_state_updated_version = ?
		WHERE
			id = ? AND
			(version = ? OR alert_rule_state_updated_version < ?)`

		res, err := sess.Exec(sql,
			m.AlertNotificationStatePending,
			newVersion,
			timeNow().Unix(),
			cmd.AlertRuleStateUpdatedVersion,
			cmd.Id,
			cmd.Version,
			cmd.AlertRuleStateUpdatedVersion)

		if err != nil {
			return err
		}

		affected, _ := res.RowsAffected()
		if affected == 0 {
			return m.ErrAlertNotificationStateVersionConflict
		}

		cmd.ResultVersion = newVersion

		return nil
	})
}

func GetOrCreateAlertNotificationState(ctx context.Context, cmd *m.GetOrCreateNotificationStateQuery) error {
	return inTransactionCtx(ctx, func(sess *DBSession) error {
		nj := &m.AlertNotificationState{}

		exist, err := getAlertNotificationState(sess, cmd, nj)

		// if exists, return it, otherwise create it with default values
		if err != nil {
			return err
		}

		if exist {
			cmd.Result = nj
			return nil
		}

		notificationState := &m.AlertNotificationState{
			OrgId:      cmd.OrgId,
			AlertId:    cmd.AlertId,
			NotifierId: cmd.NotifierId,
			State:      m.AlertNotificationStateUnknown,
			UpdatedAt:  timeNow().Unix(),
		}

		if _, err := sess.Insert(notificationState); err != nil {
			if dialect.IsUniqueConstraintViolation(err) {
				exist, err = getAlertNotificationState(sess, cmd, nj)

				if err != nil {
					return err
				}

				if !exist {
					return errors.New("Should not happen")
				}

				cmd.Result = nj
				return nil
			}

			return err
		}

		cmd.Result = notificationState
		return nil
	})
}

func getAlertNotificationState(sess *DBSession, cmd *m.GetOrCreateNotificationStateQuery, nj *m.AlertNotificationState) (bool, error) {
	return sess.
		Where("alert_notification_state.org_id = ?", cmd.OrgId).
		Where("alert_notification_state.alert_id = ?", cmd.AlertId).
		Where("alert_notification_state.notifier_id = ?", cmd.NotifierId).
		Get(nj)
}
