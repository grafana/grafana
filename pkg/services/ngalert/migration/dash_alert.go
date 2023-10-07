package migration

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
)

type dashAlert struct {
	*legacymodels.Alert
	ParsedSettings *dashAlertSettings
}

var slurpDashSQL = `
SELECT *
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
		var alerts []legacymodels.Alert
		err := sess.SQL(slurpDashSQL).Find(&alerts)
		if err != nil {
			return err
		}

		dashAlerts = make([]dashAlert, 0, len(alerts))
		for i := range alerts {
			alert := alerts[i]

			rawSettings, err := json.Marshal(alert.Settings)
			if err != nil {
				return fmt.Errorf("get settings for alert rule ID:%d, name:'%s', orgID:%d: %w", alert.ID, alert.Name, alert.OrgID, err)
			}
			var parsedSettings dashAlertSettings
			err = json.Unmarshal(rawSettings, &parsedSettings)
			if err != nil {
				return fmt.Errorf("parse settings for alert rule ID:%d, name:'%s', orgID:%d: %w", alert.ID, alert.Name, alert.OrgID, err)
			}

			dashAlerts = append(dashAlerts, dashAlert{
				Alert:          &alerts[i],
				ParsedSettings: &parsedSettings,
			})
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
