package sqlstore

import (
	"bytes"
	"fmt"
	"time"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", AlertNotificationQuery)
	bus.AddHandler("sql", CreateAlertNotificationCommand)
	bus.AddHandler("sql", UpdateAlertNotification)
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
		}

		id, err := sess.Insert(alertNotification)

		if err != nil {
			return err
		}

		alertNotification.Id = id
		cmd.Result = alertNotification
		return nil
	})
}

func UpdateAlertNotification(cmd *m.UpdateAlertNotificationCommand) error {
	return inTransaction(func(sess *xorm.Session) (err error) {
		alertNotification := &m.AlertNotification{}

		var has bool
		has, err = sess.Id(cmd.Id).Get(alertNotification)

		if err != nil {
			return err
		}

		if !has {
			return fmt.Errorf("Alert notification does not exist")
		}

		alertNotification.Name = cmd.Name
		alertNotification.Type = cmd.Type
		alertNotification.Settings = cmd.Settings
		alertNotification.Updated = time.Now()

		_, err = sess.Id(alertNotification.Id).Cols("name", "type", "settings", "updated").Update(alertNotification)

		if err != nil {
			return err
		}

		cmd.Result = alertNotification
		return nil
	})
}
