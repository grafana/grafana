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

// canBeInstant checks if any of the query nodes that are loki range queries can be migrated to instant queries.
// If any are migratable, those indices are returned.
func canBeInstant(r *models.AlertRule) ([]int, bool) {
	if len(r.Data) < 2 {
		return nil, false
	}
	var (
		optimizableIndices []int
		canBeOptimized     = false
	)
	// Loop over query nodes to find all Loki range queries.
	for i := range r.Data {
		if r.Data[i].QueryType != "range" {
			continue
		}
		var t dsType
		// We can ignore the error here, the query just won't be optimized.
		_ = json.Unmarshal(r.Data[i].Model, &t)

		if !t.isLoki() {
			continue
		}
		var validReducers bool
		// Loop over all query nodes to find the reduce node.
		for ii := range r.Data {
			// Second query part should be and expression.
			if !expr.IsDataSource(r.Data[ii].DatasourceUID) {
				continue
			}
			exprRaw := make(map[string]interface{})
			if err := json.Unmarshal(r.Data[ii].Model, &exprRaw); err != nil {
				continue
			}
			// Second query part should use first query part as expression.
			if ref, ok := exprRaw["expression"].(string); !ok || ref != r.Data[i].RefID {
				continue
			}
			// Second query part should be "last()"
			if val, ok := exprRaw["reducer"].(string); !ok || val != "last" {
				validReducers = false
				break
			}
			validReducers = true
		}
		// If we found a reduce node that uses last, we can add the loki query to the optimizations.
		if validReducers {
			canBeOptimized = true
			optimizableIndices = append(optimizableIndices, i)
		}
	}
	return optimizableIndices, canBeOptimized
}

// migrateToInstant will move the provided indices from a range-query to an instant query. This should only
// be used for loki.
func migrateToInstant(r *models.AlertRule, optimizableIndices []int) error {
	for _, lokiQueryIndex := range optimizableIndices {
		modelRaw := make(map[string]interface{})
		if err := json.Unmarshal(r.Data[lokiQueryIndex].Model, &modelRaw); err != nil {
			return err
		}
		modelRaw["queryType"] = "instant"
		model, err := json.Marshal(modelRaw)
		if err != nil {
			return err
		}
		r.Data[lokiQueryIndex].Model = model
		r.Data[lokiQueryIndex].QueryType = "instant"
	}
	return nil
}
