package store

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

const (
	grafanaCloudProm  = "grafanacloud-prom"
	grafanaCloudUsage = "grafanacloud-usage"
)

// DSType can be used to check the datasource type if it's set in the model.
type dsType struct {
	DS struct {
		Type string `json:"type"`
	} `json:"datasource"`
	Range bool `json:"range"`
}

type optimization struct {
	// Index of the query that can be optimized
	i int
	// Type of the query that ca be optimized (loki,prometheus)
	t string
}

// canBeInstant checks if any of the query nodes that are loki or prometheus range queries can be migrated to instant queries.
// If any are migratable, those indices are returned.
func canBeInstant(r *models.AlertRule) ([]optimization, bool) {
	if len(r.Data) < 2 {
		return nil, false
	}
	var (
		optimizableIndices []optimization
		canBeOptimized     = false
	)
	// Loop over query nodes to find all range queries.
	for i := range r.Data {
		var t dsType
		// We can ignore the error here, the query just won't be optimized.
		_ = json.Unmarshal(r.Data[i].Model, &t)

		switch t.DS.Type {
		case datasources.DS_PROMETHEUS:
			if !t.Range {
				continue
			}
		case datasources.DS_LOKI:
			if r.Data[i].QueryType != "range" {
				continue
			}
		default:
			// The default datasource is not saved as datasource, this is why we need to check for the datasource name.
			// Here we check the well-known grafana cloud datasources.
			if r.Data[i].DatasourceUID != grafanaCloudProm && r.Data[i].DatasourceUID != grafanaCloudUsage {
				continue
			}
			if !t.Range {
				continue
			}
			t.DS.Type = datasources.DS_PROMETHEUS
		}

		var validReducers bool
		// Loop over all query nodes to find the reduce node.
		for ii := range r.Data {
			// Second query part should be and expression.
			if !expr.IsDataSource(r.Data[ii].DatasourceUID) {
				continue
			}
			exprRaw := make(map[string]any)
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
		// If we found a reduce node that uses last, we can add the query to the optimizations.
		if validReducers {
			canBeOptimized = true
			optimizableIndices = append(optimizableIndices, optimization{
				i: i,
				t: t.DS.Type,
			})
		}
	}
	return optimizableIndices, canBeOptimized
}

// migrateToInstant will move the provided indices from a range-query to an instant query.
func migrateToInstant(r *models.AlertRule, optimizations []optimization) error {
	for _, opti := range optimizations {
		modelRaw := make(map[string]any)
		if err := json.Unmarshal(r.Data[opti.i].Model, &modelRaw); err != nil {
			return err
		}
		switch opti.t {
		case datasources.DS_PROMETHEUS:
			modelRaw["instant"] = true
			modelRaw["range"] = false
			model, err := json.Marshal(modelRaw)
			if err != nil {
				return err
			}
			r.Data[opti.i].Model = model
		case datasources.DS_LOKI:
			modelRaw["queryType"] = "instant"
			model, err := json.Marshal(modelRaw)
			if err != nil {
				return err
			}
			r.Data[opti.i].Model = model
			r.Data[opti.i].QueryType = "instant"
		default:
			return fmt.Errorf("optimization for datasource of type %s not possible", opti.t)
		}
	}
	return nil
}
