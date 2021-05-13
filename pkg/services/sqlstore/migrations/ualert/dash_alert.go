package ualert

import (
	"encoding/json"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

type dashAlert struct {
	Id          int64
	OrgId       int64
	DashboardId int64
	PanelId     int64
	Name        string
	Message     string
	Frequency   int64
	For         time.Duration

	Settings       json.RawMessage
	ParsedSettings *dashAlertSettings
	DashboardUID   string // Set from separate call
}

var slurpDashSQL = `
SELECT id,
	org_id,
	dashboard_id,
	panel_id,
	org_id,
	name,
	message,
	frequency,
	for,
	settings
FROM
	alert
`

// slurpDashAlerts loads all alerts from the alert database table into the
// the dashAlert type.
// Additionally it unmarshals the json settings for the alert into the
// ParsedSettings property of the oldDash alert.
func (m *migration) slurpDashAlerts() ([]dashAlert, error) {
	dashAlerts := []dashAlert{}
	err := m.sess.SQL(slurpDashSQL).Find(&dashAlerts)

	if err != nil {
		return nil, err
	}

	for i := range dashAlerts {
		err = json.Unmarshal(dashAlerts[i].Settings, &dashAlerts[i].ParsedSettings)
		if err != nil {
			return nil, err
		}
	}

	return dashAlerts, nil
}

// dashAlertSettings is a type for the JSON that is in the settings field of
// the alert table.
type dashAlertSettings struct {
	NoDataState         string               `json:"noDataState"`
	ExecutionErrorState string               `json:"executionErrorState"`
	Conditions          []dashAlertCondition `json:"conditions"`
	AlertRuleTags       map[string]string    `json:"alertRuleTags"`
	Notifications       []dashAlertNot       `json:"notifications"`
}

// dashAlertNot is the object that represents the Notifications array in
// dashAlertSettings
type dashAlertNot struct {
	UID string `json:"uid"`
}

// dashAlertingConditionJSON is like classic.ClassicConditionJSON except that it
// includes the model property with the query.
type dashAlertCondition struct {
	Evaluator conditionEvalJSON `json:"evaluator"`

	Operator struct {
		Type string `json:"type"`
	} `json:"operator"`

	Query struct {
		Params       []string `json:"params"`
		DatasourceID int64    `json:"datasourceId"`
		Model        json.RawMessage
	} `json:"query"`

	Reducer struct {
		// Params []interface{} `json:"params"` (Unused)
		Type string `json:"type"`
	}
}

type conditionEvalJSON struct {
	Params []float64 `json:"params"`
	Type   string    `json:"type"` // e.g. "gt"
}

type oldDash struct {
	OrgID int64            `xorm:"org_id"`
	ID    int64            `xorm:"id"`
	UID   string           `xorm:"uid"`
	Data  *simplejson.Json `xorm:"data"`
}

// slurpDash returns a map of [orgID, dashboardId] -> oldDash.
func (m *migration) slurpDash() (map[[2]int64]oldDash, error) {
	dashIDs := []oldDash{}

	err := m.sess.SQL(`SELECT org_id, id, uid FROM dashboard`).Find(&dashIDs)

	if err != nil {
		return nil, err
	}

	idToDash := make(map[[2]int64]oldDash, len(dashIDs))

	for _, ds := range dashIDs {
		idToDash[[2]int64{ds.OrgID, ds.ID}] = ds
	}

	return idToDash, nil
}
