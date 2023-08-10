package migration

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
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
	State       string

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
	%s,
	state,
	settings
FROM
	alert
WHERE org_id IN (SELECT id from org)
	AND dashboard_id IN (SELECT id from dashboard)
`

// slurpDashAlerts loads all alerts from the alert database table into
// the dashAlert type. If there are alerts that belong to either organization or dashboard that does not exist, those alerts will not be returned/
// Additionally it unmarshals the json settings for the alert into the
// ParsedSettings property of the dash alert.
func (m *migration) slurpDashAlerts(ctx context.Context) ([]dashAlert, error) {
	var dashAlerts []dashAlert
	err := m.store.WithDbSession(ctx, func(sess *db.Session) error {
		err := sess.SQL(fmt.Sprintf(slurpDashSQL, m.dialect.Quote("for"))).Find(&dashAlerts)
		if err != nil {
			return err
		}

		for i := range dashAlerts {
			err = json.Unmarshal(dashAlerts[i].Settings, &dashAlerts[i].ParsedSettings)
			if err != nil {
				da := dashAlerts[i]
				return fmt.Errorf("failed to parse alert rule ID:%d, name:'%s', orgID:%d: %w", da.Id, da.Name, da.OrgId, err)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return dashAlerts, nil
}

// dashAlertSettings is a type for the JSON that is in the settings field of
// the alert table.
type dashAlertSettings struct {
	NoDataState         string               `json:"noDataState"`
	ExecutionErrorState string               `json:"executionErrorState"`
	Conditions          []dashAlertCondition `json:"conditions"`
	AlertRuleTags       any                  `json:"alertRuleTags"`
	Notifications       []dashAlertNot       `json:"notifications"`
}

// dashAlertNot is the object that represents the Notifications array in
// dashAlertSettings
type dashAlertNot struct {
	UID string `json:"uid,omitempty"`
	ID  int64  `json:"id,omitempty"`
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
		// Params []any `json:"params"` (Unused)
		Type string `json:"type"`
	}
}

type conditionEvalJSON struct {
	Params []float64 `json:"params"`
	Type   string    `json:"type"` // e.g. "gt"
}
