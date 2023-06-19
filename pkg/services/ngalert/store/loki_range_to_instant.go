package store

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

const (
	grafanaCloudLogs          = "grafanacloud-logs"
	grafanaCloudUsageInsights = "grafanacloud-usage-insights"
	grafanaCloudStateHistory  = "grafanacloud-loki-alert-state-history"
)

func canBeInstant(r *models.AlertRule) bool {
	if len(r.Data) < 2 {
		return false
	}
	// First query part should be range query.
	if r.Data[0].QueryType != "range" {
		return false
	}
	// First query part should go to cloud logs or insights.
	if r.Data[0].DatasourceUID != grafanaCloudLogs &&
		r.Data[0].DatasourceUID != grafanaCloudUsageInsights &&
		r.Data[0].DatasourceUID != grafanaCloudStateHistory {
		return false
	}
	// Second query part should be and expression, '-100' is the legacy way to define it.
	if r.Data[1].DatasourceUID != "__expr__" && r.Data[1].DatasourceUID != "-100" {
		return false
	}
	exprRaw := make(map[string]interface{})
	if err := json.Unmarshal(r.Data[1].Model, &exprRaw); err != nil {
		return false
	}
	// Second query part should be "last()"
	if val, ok := exprRaw["reducer"].(string); !ok || val != "last" {
		return false
	}
	// Second query part should use first query part as expression.
	if ref, ok := exprRaw["expression"].(string); !ok || ref != r.Data[0].RefID {
		return false
	}
	return true
}

// migrateToInstant will move a range-query to an instant query. This should only
// be used for loki.
func migrateToInstant(r *models.AlertRule) error {
	modelRaw := make(map[string]interface{})
	if err := json.Unmarshal(r.Data[0].Model, &modelRaw); err != nil {
		return err
	}
	modelRaw["queryType"] = "instant"
	model, err := json.Marshal(modelRaw)
	if err != nil {
		return err
	}
	r.Data[0].Model = model
	r.Data[0].QueryType = "instant"
	return nil
}
