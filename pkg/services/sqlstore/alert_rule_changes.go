package sqlstore

import (
	"bytes"
	"time"

	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetAlertRuleChanges)
}

func GetAlertRuleChanges(query *m.GetAlertChangesQuery) error {
	var sql bytes.Buffer
	params := make([]interface{}, 0)

	sql.WriteString(`SELECT
					  alert_change.id,
					  alert_change.org_id,
					  alert_change.alert_id,
					  alert_change.type,
					  alert_change.created,
					  alert_change.new_alert_settings,
					  alert_change.updated_by
					  FROM alert_change
					  `)

	sql.WriteString(`WHERE alert_change.org_id = ?`)
	params = append(params, query.OrgId)

	if query.SinceId != 0 {
		sql.WriteString(`AND alert_change.id >= ?`)
		params = append(params, query.SinceId)
	}

	if query.Limit != 0 {
		sql.WriteString(` ORDER BY alert_change.id DESC LIMIT ?`)
		params = append(params, query.Limit)
	}

	alertChanges := make([]*m.AlertChange, 0)
	if err := x.Sql(sql.String(), params...).Find(&alertChanges); err != nil {
		return err
	}

	query.Result = alertChanges
	return nil
}

func SaveAlertChange(cmd *m.CreateAlertChangeCommand, sess *xorm.Session) error {
	_, err := sess.Insert(&m.AlertChange{
		OrgId:            cmd.OrgId,
		Type:             cmd.Type,
		Created:          time.Now(),
		AlertId:          cmd.AlertId,
		NewAlertSettings: cmd.NewAlertSettings,
		UpdatedBy:        cmd.UpdatedBy,
	})

	if err != nil {
		return err
	}

	return nil
}
