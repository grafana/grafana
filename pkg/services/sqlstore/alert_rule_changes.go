package sqlstore

import (
	"bytes"
	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"time"
)

func init() {
	bus.AddHandler("sql", GetAlertRuleChanges)
}

func GetAlertRuleChanges(query *m.GetAlertChangesQuery) error {
	var sql bytes.Buffer
	params := make([]interface{}, 0)

	sql.WriteString(`SELECT
					  alert_rule_change.id,
					  alert_rule_change.org_id,
					  alert_rule_change.alert_id,
					  alert_rule_change.type,
					  alert_rule_change.created
					  FROM alert_rule_change
					  `)

	sql.WriteString(`WHERE alert_rule_change.org_id = ?`)
	params = append(params, query.OrgId)

	if query.SinceId != 0 {
		sql.WriteString(`AND alert_rule_change.id >= ?`)
		params = append(params, query.SinceId)
	}

	if query.Limit != 0 {
		sql.WriteString(` ORDER BY alert_rule_change.id DESC LIMIT ?`)
		params = append(params, query.Limit)
	}

	alertChanges := make([]m.AlertRuleChange, 0)
	if err := x.Sql(sql.String(), params...).Find(&alertChanges); err != nil {
		return err
	}

	query.Result = alertChanges
	return nil
}

func SaveAlertChange(change string, alert m.AlertRule, sess *xorm.Session) error {
	_, err := sess.Insert(&m.AlertRuleChange{
		OrgId:   alert.OrgId,
		Type:    change,
		Created: time.Now(),
		AlertId: alert.Id,
	})

	if err != nil {
		return err
	}

	return nil
}
