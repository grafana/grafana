package ualert

import (
	"encoding/json"
	"time"
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

type dashAlertSettings struct {
	NoDataState         string               `json:"noDataState"`
	ExecutionErrorState string               `json:"executionErrorState"`
	Conditions          []dashAlertCondition `json:"conditions"`
	AlertRuleTags       map[string]string    `json:"alertRuleTags"`
	Notifications       []dashAlertNot       `json:"notifications"`
}

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
