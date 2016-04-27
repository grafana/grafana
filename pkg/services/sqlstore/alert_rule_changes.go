package sqlstore

import (
	"github.com/go-xorm/xorm"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"time"
)

func init() {
	bus.AddHandler("sql", GetAlertRuleChanges)
}

func GetAlertRuleChanges(query *m.GetAlertChangesQuery) error {
	alertChanges := make([]m.AlertRuleChange, 0)
	if err := x.Where("org_id = ?", query.OrgId).Find(&alertChanges); err != nil {
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
