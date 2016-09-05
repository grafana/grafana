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
	bus.AddHandler("sql", GetAlertNotifications)
	bus.AddHandler("sql", CreateAlertNotificationCommand)
	bus.AddHandler("sql", UpdateAlertNotification)
	bus.AddHandler("sql", DeleteAlertNotification)
}

func DeleteAlertNotification(cmd *m.DeleteAlertNotificationCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		sql := "DELETE FROM alert_notification WHERE alert_notification.org_id = ? AND alert_notification.id = ?"
		_, err := sess.Exec(sql, cmd.OrgId, cmd.Id)

		if err != nil {
			return err
		}

		return nil
	})
}

func GetAlertNotifications(query *m.GetAlertNotificationsQuery) error {
	return getAlertNotificationsInternal(query, x.NewSession())
}

func getAlertNotificationsInternal(query *m.GetAlertNotificationsQuery, sess *xorm.Session) error {
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

	if query.Name != "" || query.Id != 0 || len(query.Ids) > 0 {
		if query.Name != "" {
			sql.WriteString(` AND alert_notification.name = ?`)
			params = append(params, query.Name)
		}

		if query.Id != 0 {
			sql.WriteString(` AND alert_notification.id = ?`)
			params = append(params, query.Id)
		}

		if len(query.Ids) > 0 {
			sql.WriteString(` AND ((alert_notification.is_default = 1) OR alert_notification.id IN (?` + strings.Repeat(",?", len(query.Ids)-1) + "))")
			for _, v := range query.Ids {
				params = append(params, v)
			}
		}
	}

	results := make([]*m.AlertNotification, 0)
	if err := sess.Sql(sql.String(), params...).Find(&results); err != nil {
		return err
	}

	query.Result = results
	return nil
}

func CreateAlertNotificationCommand(cmd *m.CreateAlertNotificationCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		existingQuery := &m.GetAlertNotificationsQuery{OrgId: cmd.OrgId, Name: cmd.Name}
		err := getAlertNotificationsInternal(existingQuery, sess)

		if err != nil {
			return err
		}

		if len(existingQuery.Result) > 0 {
			return fmt.Errorf("Alert notification name %s already exists", cmd.Name)
		}

		alertNotification := &m.AlertNotification{
			OrgId:     cmd.OrgId,
			Name:      cmd.Name,
			Type:      cmd.Type,
			Settings:  cmd.Settings,
			Created:   time.Now(),
			Updated:   time.Now(),
			IsDefault: cmd.IsDefault,
		}

		if _, err = sess.Insert(alertNotification); err != nil {
			return err
		}

		cmd.Result = alertNotification
		return nil
	})
}

func UpdateAlertNotification(cmd *m.UpdateAlertNotificationCommand) error {
	return inTransaction(func(sess *xorm.Session) (err error) {
		current := m.AlertNotification{}

		if _, err = sess.Id(cmd.Id).Get(&current); err != nil {
			return err
		}

		// check if name exists
		sameNameQuery := &m.GetAlertNotificationsQuery{OrgId: cmd.OrgId, Name: cmd.Name}
		if err := getAlertNotificationsInternal(sameNameQuery, sess); err != nil {
			return err
		}

		if len(sameNameQuery.Result) > 0 && sameNameQuery.Result[0].Id != current.Id {
			return fmt.Errorf("Alert notification name %s already exists", cmd.Name)
		}

		current.Updated = time.Now()
		current.Settings = cmd.Settings
		current.Name = cmd.Name
		current.Type = cmd.Type
		current.IsDefault = cmd.IsDefault

		sess.UseBool("is_default")

		if affected, err := sess.Id(cmd.Id).Update(current); err != nil {
			return err
		} else if affected == 0 {
			return fmt.Errorf("Could not find alert notification")
		}

		cmd.Result = &current
		return nil
	})
}
