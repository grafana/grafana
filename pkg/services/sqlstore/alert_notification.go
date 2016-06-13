package sqlstore

import (
	"bytes"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetAlertNotifications)
}

func GetAlertNotifications(query *m.GetAlertNotificationQuery) error {
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
	if err := x.Sql(sql.String(), params...).Find(&result); err != nil {
		return err
	}

	query.Result = result
	return nil
}

/*
func CreateAlertNotification(cmd *m.CreateAlertNotificationCommand) error {
	return inTransaction(func(sess *xorm.Session) error {


	})
}

func UpdateAlertNotification(cmd *m.UpdateAlertNotificationCommand) error {

}*/
