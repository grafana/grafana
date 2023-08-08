package store

import (
	"encoding/json"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// DSType can be used to check the datasource type if it's set in the model.
type dsType struct {
	DS struct {
		Type string `json:"type"`
	} `json:"datasource"`
}

func (t dsType) isLoki() bool {
	return t.DS.Type == datasources.DS_LOKI
}

func canBeInstant(r *models.AlertRule) bool {
	if len(r.Data) < 2 {
		return false
	}
	// First query part should be range query.
	if r.Data[0].QueryType != "range" {
		return false
	}

	var t dsType
	// We can ignore the error here, the query just won't be optimized.
	_ = json.Unmarshal(r.Data[0].Model, &t)

	if !t.isLoki() {
		return false
	}

	exprRaw := make(map[string]interface{})
	if err := json.Unmarshal(r.Data[1].Model, &exprRaw); err != nil {
		return false
	}

	// Second query part should be and expression.
	if !expr.IsDataSource(r.Data[1].DatasourceUID) {
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
