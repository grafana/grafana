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

// OptimizeAlertQueries was added to mitigate the high load that could be created by loki range queries.
// In previous versions of Grafana, Loki datasources would default to range queries
// instead of instant queries, sometimes creating unnecessary load. This is only
// done for Grafana Cloud.
func OptimizeAlertQueries(queries []models.AlertQuery) ([]Optimization, error) {
	if optimizations, migratable := canBeInstant(queries); migratable {
		err := migrateToInstant(queries, optimizations)
		if err != nil {
			return nil, err
		}
		return optimizations, nil
	}
	return nil, nil
}

// DSType can be used to check the datasource type if it's set in the model.
type dsType struct {
	DS struct {
		Type string `json:"type"`
	} `json:"datasource"`
	Range bool `json:"range"`
}

type Optimization struct {
	// RefID of the query that can be optimized
	RefID string
	// Index of the query that can be optimized
	i int
	// Type of the query that ca be optimized (loki,prometheus)
	t string
}

// canBeInstant checks if any of the query nodes that are loki or prometheus range queries can be migrated to instant queries.
// If any are migratable, those indices are returned.
func canBeInstant(queries []models.AlertQuery) ([]Optimization, bool) {
	if len(queries) < 2 {
		return nil, false
	}
	var (
		optimizableIndices []Optimization
		canBeOptimized     = false
	)
	// Loop over query nodes to find all range queries.
	for i := range queries {
		var t dsType
		// We can ignore the error here, the query just won't be optimized.
		_ = json.Unmarshal(queries[i].Model, &t)

		switch t.DS.Type {
		case datasources.DS_PROMETHEUS:
			if !t.Range {
				continue
			}
		case datasources.DS_LOKI:
			if queries[i].QueryType != "range" {
				continue
			}
		default:
			// The default datasource is not saved as datasource, this is why we need to check for the datasource name.
			// Here we check the well-known grafana cloud datasources.
			if queries[i].DatasourceUID != grafanaCloudProm && queries[i].DatasourceUID != grafanaCloudUsage {
				continue
			}
			if !t.Range {
				continue
			}
			t.DS.Type = datasources.DS_PROMETHEUS
		}

		var validReducers bool
		// Loop over all query nodes to find the reduce node.
		for ii := range queries {
			// Second query part should be and expression.
			if !expr.IsDataSource(queries[ii].DatasourceUID) {
				continue
			}
			exprRaw := make(map[string]any)
			if err := json.Unmarshal(queries[ii].Model, &exprRaw); err != nil {
				continue
			}
			// Second query part should use first query part as expression.
			if ref, ok := exprRaw["expression"].(string); !ok || ref != queries[i].RefID {
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
			optimizableIndices = append(optimizableIndices, Optimization{
				RefID: queries[i].RefID,
				i:     i,
				t:     t.DS.Type,
			})
		}
	}
	return optimizableIndices, canBeOptimized
}

// migrateToInstant will move the provided indices from a range-query to an instant query.
func migrateToInstant(queries []models.AlertQuery, optimizations []Optimization) error {
	for _, opti := range optimizations {
		modelRaw := make(map[string]any)
		if err := json.Unmarshal(queries[opti.i].Model, &modelRaw); err != nil {
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
			queries[opti.i].Model = model
		case datasources.DS_LOKI:
			modelRaw["queryType"] = "instant"
			model, err := json.Marshal(modelRaw)
			if err != nil {
				return err
			}
			queries[opti.i].Model = model
			queries[opti.i].QueryType = "instant"
		default:
			return fmt.Errorf("optimization for datasource of type %s not possible", opti.t)
		}
	}
	return nil
}
