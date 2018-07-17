package sqlstore

import (
	"bytes"
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
	bus.AddHandler("sql", DeleteAlertNotificationById)
	bus.AddHandler("sql", DeleteAlertNotificationByName)
	bus.AddHandler("sql", GetAlertNotificationsToSend)
	bus.AddHandler("sql", GetAllAlertNotifications)
}

func DeleteAlertNotificationById(cmd *m.DeleteAlertNotificationByIdCommand) error {
	return inTransaction(func(sess *DBSession) error {
		sql := "DELETE FROM alert_notification WHERE alert_notification.org_id = ? AND alert_notification.id = ?"
		_, err := sess.Exec(sql, cmd.OrgId, cmd.Id)
		return err
	})
}

func DeleteAlertNotificationByName(cmd *m.DeleteAlertNotificationByNameCommand) error {
	return inTransaction(func(sess *DBSession) error {
		sql := "DELETE FROM alert_notification WHERE alert_notification.org_id = ? AND alert_notification.name = ?"
		_, err := sess.Exec(sql, cmd.OrgId, cmd.Name)
		return err
	})
}

func GetAlertNotifications(query *m.GetAlertNotificationsQuery) error {
	return getAlertNotificationInternal(query, newSession())
}

func GetAllAlertNotifications(query *m.GetAllAlertNotificationsQuery) error {
	results := make([]*m.AlertNotification, 0)
	if err := x.Where("org_id = ?", query.OrgId).Find(&results); err != nil {
		return err
	}

	query.Result = results
	return nil
}

func GetAlertNotificationsToSend(query *m.GetAlertNotificationsToSendQuery) error {
	var sql bytes.Buffer
	params := make([]interface{}, 0)

	sql.WriteString(`SELECT
										alert_notification.id,
										alert_notification.org_id,
										alert_notification.name,
										alert_notification.type,
										alert_notification.created,
										alert_notification.updated,
										alert_notification.settings,
										alert_notification.is_default
										FROM alert_notification
	  							`)

	sql.WriteString(` WHERE alert_notification.org_id = ?`)
	params = append(params, query.OrgId)

	sql.WriteString(` AND ((alert_notification.is_default = ?)`)
	params = append(params, dialect.BooleanStr(true))
	if len(query.Ids) > 0 {
		sql.WriteString(` OR alert_notification.id IN (?` + strings.Repeat(",?", len(query.Ids)-1) + ")")
		for _, v := range query.Ids {
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
										alert_notification.org_id,
										alert_notification.name,
										alert_notification.type,
										alert_notification.created,
										alert_notification.updated,
										alert_notification.settings,
										alert_notification.is_default
										FROM alert_notification
	  							`)

	sql.WriteString(` WHERE alert_notification.org_id = ?`)
	params = append(params, query.OrgId)

	if query.Name != "" || query.Id != 0 || query.Uid != "" {
		if query.Name != "" {
			sql.WriteString(` AND alert_notification.name = ?`)
			params = append(params, query.Name)
		}

		if query.Id != 0 {
			sql.WriteString(` AND alert_notification.id = ?`)
			params = append(params, query.Id)
		}

		if query.Uid != "" {
			sql.WriteString(` AND alert_notification.uid = ?`)
			params = append(params, query.Uid)
		}
	}

	results := make([]*m.AlertNotification, 0)
	if err := sess.Sql(sql.String(), params...).Find(&results); err != nil {
		return err
	}

	if len(results) == 0 {
		query.Result = nil
	} else {
		query.Result = results[0]
	}

	return nil
}

func generateNewAlertNotificationUid(sess *DBSession, orgId int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUid()

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

func CreateAlertNotificationCommand(cmd *m.CreateAlertNotificationCommand) error {
	return inTransaction(func(sess *DBSession) error {
		fmt.Printf("Adding: %+v\n\n", cmd)
		existingQuery := &m.GetAlertNotificationsQuery{OrgId: cmd.OrgId, Name: cmd.Name}
		err := getAlertNotificationInternal(existingQuery, sess)

		if err != nil {
			return err
		}

		if existingQuery.Result != nil {
			return fmt.Errorf("Alert notification name %s already exists", cmd.Name)
		}

		alertNotification := &m.AlertNotification{
			OrgId:     cmd.OrgId,
			Uid:       cmd.Uid,
			Name:      cmd.Name,
			Type:      cmd.Type,
			Settings:  cmd.Settings,
			Created:   time.Now(),
			Updated:   time.Now(),
			IsDefault: cmd.IsDefault,
		}

		// If no UID has been provided, generate a random UID.
		if alertNotification.Uid == "" {
			uid, err := generateNewAlertNotificationUid(sess, cmd.OrgId)
			if err != nil {
				return err
			}

			alertNotification.Uid = uid
		}

		fmt.Printf("%+v\n\n", alertNotification)

		if _, err = sess.Insert(alertNotification); err != nil {
			return err
		}

		cmd.Result = alertNotification
		return nil
	})
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

		sess.UseBool("is_default")

		if affected, err := sess.ID(cmd.Id).Update(current); err != nil {
			return err
		} else if affected == 0 {
			return fmt.Errorf("Could not find alert notification")
		}

		cmd.Result = &current
		return nil
	})
}
