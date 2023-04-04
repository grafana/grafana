package alerting

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/util"
)

type AlertNotificationStore interface {
	DeleteAlertNotification(ctx context.Context, cmd *models.DeleteAlertNotificationCommand) error
	DeleteAlertNotificationWithUid(ctx context.Context, cmd *models.DeleteAlertNotificationWithUidCommand) error
	GetAlertNotifications(ctx context.Context, query *models.GetAlertNotificationsQuery) (*models.AlertNotification, error)
	GetAlertNotificationUidWithId(ctx context.Context, query *models.GetAlertNotificationUidQuery) (string, error)
	GetAlertNotificationsWithUid(ctx context.Context, query *models.GetAlertNotificationsWithUidQuery) (*models.AlertNotification, error)
	GetAllAlertNotifications(ctx context.Context, query *models.GetAllAlertNotificationsQuery) ([]*models.AlertNotification, error)
	GetAlertNotificationsWithUidToSend(ctx context.Context, query *models.GetAlertNotificationsWithUidToSendQuery) ([]*models.AlertNotification, error)
	CreateAlertNotificationCommand(ctx context.Context, cmd *models.CreateAlertNotificationCommand) (*models.AlertNotification, error)
	UpdateAlertNotification(ctx context.Context, cmd *models.UpdateAlertNotificationCommand) (*models.AlertNotification, error)
	UpdateAlertNotificationWithUid(ctx context.Context, cmd *models.UpdateAlertNotificationWithUidCommand) (*models.AlertNotification, error)
	SetAlertNotificationStateToCompleteCommand(ctx context.Context, cmd *models.SetAlertNotificationStateToCompleteCommand) error
	SetAlertNotificationStateToPendingCommand(ctx context.Context, cmd *models.SetAlertNotificationStateToPendingCommand) error
	GetOrCreateAlertNotificationState(ctx context.Context, cmd *models.GetOrCreateNotificationStateQuery) (*models.AlertNotificationState, error)
}

// timeNow makes it possible to test usage of time
var timeNow = time.Now

func (ss *sqlStore) DeleteAlertNotification(ctx context.Context, cmd *models.DeleteAlertNotificationCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		sql := "DELETE FROM alert_notification WHERE alert_notification.org_id = ? AND alert_notification.id = ?"
		res, err := sess.Exec(sql, cmd.OrgID, cmd.ID)
		if err != nil {
			return err
		}
		rowsAffected, err := res.RowsAffected()
		if err != nil {
			return err
		}

		if rowsAffected == 0 {
			return models.ErrAlertNotificationNotFound
		}

		if _, err := sess.Exec("DELETE FROM alert_notification_state WHERE alert_notification_state.org_id = ? AND alert_notification_state.notifier_id = ?", cmd.OrgID, cmd.ID); err != nil {
			return err
		}

		return nil
	})
}

func (ss *sqlStore) DeleteAlertNotificationWithUid(ctx context.Context, cmd *models.DeleteAlertNotificationWithUidCommand) (err error) {
	var res *models.AlertNotification
	if err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		existingNotification := &models.GetAlertNotificationsWithUidQuery{OrgID: cmd.OrgID, UID: cmd.UID}
		res, err = getAlertNotificationWithUidInternal(ctx, existingNotification, sess)
		return err
	}); err != nil {
		return err
	}

	if res == nil {
		return models.ErrAlertNotificationNotFound
	}

	cmd.DeletedAlertNotificationID = res.ID
	deleteCommand := &models.DeleteAlertNotificationCommand{
		ID:    res.ID,
		OrgID: res.OrgID,
	}
	return ss.DeleteAlertNotification(ctx, deleteCommand)
}

func (ss *sqlStore) GetAlertNotifications(ctx context.Context, query *models.GetAlertNotificationsQuery) (res *models.AlertNotification, err error) {
	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		res, err = getAlertNotificationInternal(ctx, query, sess)
		return err
	})
	return res, err
}

func (ss *sqlStore) GetAlertNotificationUidWithId(ctx context.Context, query *models.GetAlertNotificationUidQuery) (res string, err error) {
	cacheKey := newAlertNotificationUidCacheKey(query.OrgID, query.ID)

	if cached, found := ss.cache.Get(cacheKey); found {
		return cached.(string), nil
	}

	if err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		res, err = getAlertNotificationUidInternal(ctx, query, sess)
		return err
	}); err != nil {
		return "", err
	}

	ss.cache.Set(cacheKey, res, -1) // Infinite, never changes
	return res, nil
}

func newAlertNotificationUidCacheKey(orgID, notificationId int64) string {
	return fmt.Sprintf("notification-uid-by-org-%d-and-id-%d", orgID, notificationId)
}

func (ss *sqlStore) GetAlertNotificationsWithUid(ctx context.Context, query *models.GetAlertNotificationsWithUidQuery) (res *models.AlertNotification, err error) {
	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		res, err = getAlertNotificationWithUidInternal(ctx, query, sess)
		return err
	})
	return res, err
}

func (ss *sqlStore) GetAllAlertNotifications(ctx context.Context, query *models.GetAllAlertNotificationsQuery) (res []*models.AlertNotification, err error) {
	res = make([]*models.AlertNotification, 0)
	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		if err := sess.Where("org_id = ?", query.OrgID).Asc("name").Find(&res); err != nil {
			return err
		}
		return nil
	})
	return res, err
}

func (ss *sqlStore) GetAlertNotificationsWithUidToSend(ctx context.Context, query *models.GetAlertNotificationsWithUidToSendQuery) (res []*models.AlertNotification, err error) {
	res = make([]*models.AlertNotification, 0)
	err = ss.db.WithDbSession(ctx, func(sess *db.Session) error {
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
										alert_notification.secure_settings,
										alert_notification.is_default,
										alert_notification.disable_resolve_message,
										alert_notification.send_reminder,
										alert_notification.frequency
										FROM alert_notification
	  							`)

		sql.WriteString(` WHERE alert_notification.org_id = ?`)
		params = append(params, query.OrgID)

		sql.WriteString(` AND ((alert_notification.is_default = ?)`)
		params = append(params, ss.db.GetDialect().BooleanStr(true))

		if len(query.UIDs) > 0 {
			sql.WriteString(` OR alert_notification.uid IN (?` + strings.Repeat(",?", len(query.UIDs)-1) + ")")
			for _, v := range query.UIDs {
				params = append(params, v)
			}
		}
		sql.WriteString(`)`)

		return sess.SQL(sql.String(), params...).Find(&res)
	})
	return res, err
}

func getAlertNotificationUidInternal(ctx context.Context, query *models.GetAlertNotificationUidQuery, sess *db.Session) (res string, err error) {
	var sql bytes.Buffer
	params := make([]interface{}, 0)

	sql.WriteString(`SELECT
										alert_notification.uid
										FROM alert_notification
	  							`)

	sql.WriteString(` WHERE alert_notification.org_id = ?`)
	params = append(params, query.OrgID)

	sql.WriteString(` AND alert_notification.id = ?`)
	params = append(params, query.ID)

	results := make([]string, 0)
	if err := sess.SQL(sql.String(), params...).Find(&results); err != nil {
		return "", err
	}

	if len(results) == 0 {
		return "", models.ErrAlertNotificationFailedTranslateUniqueID
	}

	res = results[0]
	return res, nil
}

func getAlertNotificationInternal(ctx context.Context, query *models.GetAlertNotificationsQuery, sess *db.Session) (res *models.AlertNotification, err error) {
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
										alert_notification.secure_settings,
										alert_notification.is_default,
										alert_notification.disable_resolve_message,
										alert_notification.send_reminder,
										alert_notification.frequency
										FROM alert_notification
	  							`)

	sql.WriteString(` WHERE alert_notification.org_id = ?`)
	params = append(params, query.OrgID)

	if query.Name != "" || query.ID != 0 {
		if query.Name != "" {
			sql.WriteString(` AND alert_notification.name = ?`)
			params = append(params, query.Name)
		}

		if query.ID != 0 {
			sql.WriteString(` AND alert_notification.id = ?`)
			params = append(params, query.ID)
		}
	}

	results := make([]*models.AlertNotification, 0)
	if err := sess.SQL(sql.String(), params...).Find(&results); err != nil {
		return nil, err
	}

	if len(results) == 0 {
		return nil, nil
	}
	return results[0], nil
}

func getAlertNotificationWithUidInternal(ctx context.Context, query *models.GetAlertNotificationsWithUidQuery, sess *db.Session) (res *models.AlertNotification, err error) {
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
										alert_notification.secure_settings,
										alert_notification.is_default,
										alert_notification.disable_resolve_message,
										alert_notification.send_reminder,
										alert_notification.frequency
										FROM alert_notification
	  							`)

	sql.WriteString(` WHERE alert_notification.org_id = ? AND alert_notification.uid = ?`)
	params = append(params, query.OrgID, query.UID)

	results := make([]*models.AlertNotification, 0)
	if err := sess.SQL(sql.String(), params...).Find(&results); err != nil {
		return nil, err
	}

	if len(results) == 0 {
		return nil, nil
	}
	return results[0], nil
}

func (ss *sqlStore) CreateAlertNotificationCommand(ctx context.Context, cmd *models.CreateAlertNotificationCommand) (res *models.AlertNotification, err error) {
	err = ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		if cmd.UID == "" {
			uid, uidGenerationErr := generateNewAlertNotificationUid(ctx, sess, cmd.OrgID)
			if uidGenerationErr != nil {
				return uidGenerationErr
			}

			cmd.UID = uid
		}
		existingQuery := &models.GetAlertNotificationsWithUidQuery{OrgID: cmd.OrgID, UID: cmd.UID}
		if notification, err := getAlertNotificationWithUidInternal(ctx, existingQuery, sess); err != nil {
			return err
		} else if notification != nil {
			return models.ErrAlertNotificationWithSameUIDExists
		}

		// check if name exists
		sameNameQuery := &models.GetAlertNotificationsQuery{OrgID: cmd.OrgID, Name: cmd.Name}
		if notification, err := getAlertNotificationInternal(ctx, sameNameQuery, sess); err != nil {
			return err
		} else if notification != nil {
			return models.ErrAlertNotificationWithSameNameExists
		}

		var frequency time.Duration
		if cmd.SendReminder {
			if cmd.Frequency == "" {
				return models.ErrNotificationFrequencyNotFound
			}

			frequency, err = time.ParseDuration(cmd.Frequency)
			if err != nil {
				return err
			}
		}

		// delete empty keys
		for k, v := range cmd.SecureSettings {
			if v == "" {
				delete(cmd.SecureSettings, k)
			}
		}

		alertNotification := &models.AlertNotification{
			UID:                   cmd.UID,
			OrgID:                 cmd.OrgID,
			Name:                  cmd.Name,
			Type:                  cmd.Type,
			Settings:              cmd.Settings,
			SecureSettings:        cmd.EncryptedSecureSettings,
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

		res = alertNotification
		return nil
	})
	return res, err
}

func generateNewAlertNotificationUid(ctx context.Context, sess *db.Session, orgId int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()
		exists, err := sess.Where("org_id=? AND uid=?", orgId, uid).Get(&models.AlertNotification{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", models.ErrAlertNotificationFailedGenerateUniqueUid
}

func (ss *sqlStore) UpdateAlertNotification(ctx context.Context, cmd *models.UpdateAlertNotificationCommand) (res *models.AlertNotification, err error) {
	err = ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) (err error) {
		current := models.AlertNotification{}

		if _, err = sess.ID(cmd.ID).Get(&current); err != nil {
			return err
		}

		if current.ID == 0 {
			return models.ErrAlertNotificationNotFound
		}

		// check if name exists
		sameNameQuery := &models.GetAlertNotificationsQuery{OrgID: cmd.OrgID, Name: cmd.Name}
		notification, err := getAlertNotificationInternal(ctx, sameNameQuery, sess)
		if err != nil {
			return err
		}

		if notification != nil && notification.ID != current.ID {
			return fmt.Errorf("alert notification name %q already exists", cmd.Name)
		}

		// delete empty keys
		for k, v := range cmd.SecureSettings {
			if v == "" {
				delete(cmd.SecureSettings, k)
			}
		}

		current.Updated = time.Now()
		current.Settings = cmd.Settings
		current.SecureSettings = cmd.EncryptedSecureSettings
		current.Name = cmd.Name
		current.Type = cmd.Type
		current.IsDefault = cmd.IsDefault
		current.SendReminder = cmd.SendReminder
		current.DisableResolveMessage = cmd.DisableResolveMessage

		if cmd.UID != "" {
			current.UID = cmd.UID
		}

		if current.SendReminder {
			if cmd.Frequency == "" {
				return models.ErrNotificationFrequencyNotFound
			}

			frequency, err := time.ParseDuration(cmd.Frequency)
			if err != nil {
				return err
			}

			current.Frequency = frequency
		}

		sess.UseBool("is_default", "send_reminder", "disable_resolve_message")

		if affected, err := sess.ID(cmd.ID).Update(current); err != nil {
			return err
		} else if affected == 0 {
			return fmt.Errorf("could not update alert notification")
		}

		res = &current
		return nil
	})
	return res, err
}

func (ss *sqlStore) UpdateAlertNotificationWithUid(ctx context.Context, cmd *models.UpdateAlertNotificationWithUidCommand) (res *models.AlertNotification, err error) {
	getAlertNotificationWithUidQuery := &models.GetAlertNotificationsWithUidQuery{OrgID: cmd.OrgID, UID: cmd.UID}

	if err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		res, err = getAlertNotificationWithUidInternal(ctx, getAlertNotificationWithUidQuery, sess)
		return err
	}); err != nil {
		return nil, err
	}

	current := res
	if current == nil {
		return nil, models.ErrAlertNotificationNotFound
	}

	if cmd.NewUID == "" {
		cmd.NewUID = cmd.UID
	}

	updateNotification := &models.UpdateAlertNotificationCommand{
		ID:                    current.ID,
		UID:                   cmd.NewUID,
		Name:                  cmd.Name,
		Type:                  cmd.Type,
		SendReminder:          cmd.SendReminder,
		DisableResolveMessage: cmd.DisableResolveMessage,
		Frequency:             cmd.Frequency,
		IsDefault:             cmd.IsDefault,
		Settings:              cmd.Settings,
		SecureSettings:        cmd.SecureSettings,

		OrgID: cmd.OrgID,
	}

	return ss.UpdateAlertNotification(ctx, updateNotification)
}

func (ss *sqlStore) SetAlertNotificationStateToCompleteCommand(ctx context.Context, cmd *models.SetAlertNotificationStateToCompleteCommand) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		version := cmd.Version
		var current models.AlertNotificationState
		if _, err := sess.ID(cmd.ID).Get(&current); err != nil {
			return err
		}

		newVersion := cmd.Version + 1
		sql := `UPDATE alert_notification_state SET
			state = ?,
			version = ?,
			updated_at = ?
		WHERE
			id = ?`

		_, err := sess.Exec(sql, models.AlertNotificationStateCompleted, newVersion, timeNow().Unix(), cmd.ID)
		if err != nil {
			return err
		}

		if current.Version != version {
			ss.log.Error("notification state out of sync. the notification is marked as complete but has been modified between set as pending and completion.", "notifierId", current.NotifierID)
		}

		return nil
	})
}

func (ss *sqlStore) SetAlertNotificationStateToPendingCommand(ctx context.Context, cmd *models.SetAlertNotificationStateToPendingCommand) error {
	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
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
			models.AlertNotificationStatePending,
			newVersion,
			timeNow().Unix(),
			cmd.AlertRuleStateUpdatedVersion,
			cmd.ID,
			cmd.Version,
			cmd.AlertRuleStateUpdatedVersion)

		if err != nil {
			return err
		}

		affected, _ := res.RowsAffected()
		if affected == 0 {
			return models.ErrAlertNotificationStateVersionConflict
		}

		cmd.ResultVersion = newVersion

		return nil
	})
}

func (ss *sqlStore) GetOrCreateAlertNotificationState(ctx context.Context, cmd *models.GetOrCreateNotificationStateQuery) (res *models.AlertNotificationState, err error) {
	err = ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		nj := &models.AlertNotificationState{}

		exist, err := getAlertNotificationState(ctx, sess, cmd, nj)

		// if exists, return it, otherwise create it with default values
		if err != nil {
			return err
		}

		if exist {
			res = nj
			return nil
		}

		notificationState := &models.AlertNotificationState{
			OrgID:      cmd.OrgID,
			AlertID:    cmd.AlertID,
			NotifierID: cmd.NotifierID,
			State:      models.AlertNotificationStateUnknown,
			UpdatedAt:  timeNow().Unix(),
		}

		if _, err := sess.Insert(notificationState); err != nil {
			if ss.db.GetDialect().IsUniqueConstraintViolation(err) {
				exist, err = getAlertNotificationState(ctx, sess, cmd, nj)

				if err != nil {
					return err
				}

				if !exist {
					return errors.New("should not happen")
				}

				res = nj
				return nil
			}

			return err
		}

		res = notificationState
		return nil
	})
	return res, err
}

func getAlertNotificationState(ctx context.Context, sess *db.Session, cmd *models.GetOrCreateNotificationStateQuery, nj *models.AlertNotificationState) (bool, error) {
	return sess.
		Where("alert_notification_state.org_id = ?", cmd.OrgID).
		Where("alert_notification_state.alert_id = ?", cmd.AlertID).
		Where("alert_notification_state.notifier_id = ?", cmd.NotifierID).
		Get(nj)
}
