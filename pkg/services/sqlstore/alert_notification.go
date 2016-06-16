package sqlstore

import (
	"bytes"
	"fmt"
	"strconv"
	"time"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", AlertNotificationQuery)
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

func AlertNotificationQuery(query *m.GetAlertNotificationQuery) error {
	return getAlertNotifications(query, x.NewSession())
}

func getAlertNotifications(query *m.GetAlertNotificationQuery, sess *xorm.Session) error {
	var sql bytes.Buffer
	params := make([]interface{}, 0)

	sql.WriteString(`SELECT
	   					  alert_notification.id,
	   					  alert_notification.org_id,
	   					  alert_notification.name,
	                      alert_notification.type,
	   					  alert_notification.created,
	                      alert_notification.updated,
	                      alert_notification.settings
	   					  FROM alert_notification
	   					  `)

	sql.WriteString(` WHERE alert_notification.org_id = ?`)
	params = append(params, query.OrgID)

	if query.Name != "" {
		sql.WriteString(` AND alert_notification.name = ?`)
		params = append(params, query.Name)
	}

	if query.Id != 0 {
		sql.WriteString(` AND alert_notification.id = ?`)
		params = append(params, strconv.Itoa(int(query.Id)))
	}

	if len(query.Ids) > 0 {
		sql.WriteString(` AND (`)

		for i, id := range query.Ids {
			if i != 0 {
				sql.WriteString(` OR`)
			}
			sql.WriteString(` alert_notification.id = ?`)
			params = append(params, id)
		}

		sql.WriteString(`)`)
	}

	var result []*m.AlertNotification
	if err := sess.Sql(sql.String(), params...).Find(&result); err != nil {
		return err
	}

	query.Result = result
	return nil
}

func CreateAlertNotificationCommand(cmd *m.CreateAlertNotificationCommand) error {
	return inTransaction(func(sess *xorm.Session) error {
		existingQuery := &m.GetAlertNotificationQuery{OrgID: cmd.OrgID, Name: cmd.Name}
		err := getAlertNotifications(existingQuery, sess)

		if err != nil {
			return err
		}

		if len(existingQuery.Result) > 0 {
			return fmt.Errorf("Alert notification name %s already exists", cmd.Name)
		}

		alertNotification := &m.AlertNotification{
			OrgId:    cmd.OrgID,
			Name:     cmd.Name,
			Type:     cmd.Type,
			Created:  time.Now(),
			Settings: cmd.Settings,
			Updated:  time.Now(),
		}

		_, err = sess.Insert(alertNotification)

		if err != nil {
			return err
		}

		//alertNotification.Id = int(id)
		cmd.Result = alertNotification
		return nil
	})
}

func UpdateAlertNotification(cmd *m.UpdateAlertNotificationCommand) error {
	return inTransaction(func(sess *xorm.Session) (err error) {
		current := &m.AlertNotification{}
		_, err = sess.Id(cmd.Id).Get(current)

		if err != nil {
			return err
		}

		alertNotification := &m.AlertNotification{}
		alertNotification.Id = cmd.Id
		alertNotification.OrgId = cmd.OrgID
		alertNotification.Name = cmd.Name
		alertNotification.Type = cmd.Type
		alertNotification.Settings = cmd.Settings
		alertNotification.Updated = time.Now()
		alertNotification.Created = current.Created

		var affected int64
		//affected, err = sess.Id(alertNotification.Id).Cols("name", "type", "settings", "updated").Update(alertNotification)
		affected, err = sess.Id(alertNotification.Id).Update(alertNotification)

		if err != nil {
			return err
		}

		if affected == 0 {
			return fmt.Errorf("Could not find alert notification")
		}

		cmd.Result = alertNotification
		return nil
	})
}
