package state

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

const gcConfiguredThresholdKey = "_gc_configured_threshold"

// extractConfiguredThreshold parses the alert rule's condition query to
// extract the configured threshold value. Returns nil if not found.
func extractConfiguredThreshold(alertRule *models.AlertRule) *float64 {
	// Find the condition query by matching alertRule.Condition RefID
	var conditionQuery *models.AlertQuery
	for i := range alertRule.Data {
		if alertRule.Data[i].RefID == alertRule.Condition {
			conditionQuery = &alertRule.Data[i]
			break
		}
	}
	if conditionQuery == nil {
		return nil
	}

	if !expr.IsDataSource(conditionQuery.DatasourceUID) {
		return nil
	}

	// Single unmarshal: embed type check and threshold config together.
	var config struct {
		Type string `json:"type"`
		expr.ThresholdCommandConfig
	}
	if err := json.Unmarshal(conditionQuery.Model, &config); err != nil {
		return nil
	}
	if config.Type != string(expr.QueryTypeThreshold) {
		return nil
	}
	if len(config.Conditions) == 0 || len(config.Conditions[0].Evaluator.Params) == 0 {
		return nil
	}

	v := config.Conditions[0].Evaluator.Params[0]
	return &v
}
