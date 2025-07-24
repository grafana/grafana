package prom

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type CommonQueryModel struct {
	Datasource datasources.DataSource `json:"datasource"`
	RefID      string                 `json:"refId"`
	Type       expr.QueryType         `json:"type"`
}

// createAlertQueryWithDefaults creates an AlertQuery with default values initialized.
func createAlertQueryWithDefaults(datasourceUID string, modelData any, refID string, relTimeRange *models.RelativeTimeRange, queryType string) (models.AlertQuery, error) {
	modelJSON, err := json.Marshal(modelData)
	if err != nil {
		return models.AlertQuery{}, fmt.Errorf("failed to marshal query model: %w", err)
	}

	query := models.AlertQuery{
		DatasourceUID: datasourceUID,
		Model:         modelJSON,
		RefID:         refID,
		QueryType:     queryType,
	}

	// Set relative time range if provided
	if relTimeRange != nil {
		query.RelativeTimeRange = *relTimeRange
	}

	if err := query.InitDefaults(); err != nil {
		return models.AlertQuery{}, err
	}

	return query, nil
}

func createQueryNode(datasourceUID, datasourceType, expr string, fromTimeRange, evaluationOffset time.Duration) (models.AlertQuery, error) {
	modelData := map[string]any{
		"datasource": map[string]any{
			"type": datasourceType,
			"uid":  datasourceUID,
		},
		"expr":    expr,
		"instant": true,
		"range":   false,
		"refId":   queryRefID,
	}

	if datasourceType == datasources.DS_LOKI {
		modelData["queryType"] = "instant"
	}

	relTimeRange := models.RelativeTimeRange{
		From: models.Duration(fromTimeRange + evaluationOffset),
		To:   models.Duration(evaluationOffset),
	}

	return createAlertQueryWithDefaults(datasourceUID, modelData, queryRefID, &relTimeRange, datasourceType)
}

type MathQueryModel struct {
	expr.MathQuery
	CommonQueryModel
}

func createMathNode() (models.AlertQuery, error) {
	ds, err := expr.DataSourceModelFromNodeType(expr.TypeCMDNode)
	if err != nil {
		return models.AlertQuery{}, err
	}

	model := MathQueryModel{
		CommonQueryModel: CommonQueryModel{
			Datasource: *ds,
			RefID:      prometheusMathRefID,
			Type:       expr.QueryTypeMath,
		},
		MathQuery: expr.MathQuery{
			Expression: fmt.Sprintf("is_number($%[1]s) || is_nan($%[1]s) || is_inf($%[1]s)", queryRefID),
		},
	}

	return createAlertQueryWithDefaults(expr.DatasourceUID, model, prometheusMathRefID, nil, string(expr.QueryTypeMath))
}

type ThresholdQueryModel struct {
	expr.ThresholdQuery
	CommonQueryModel
}

func createThresholdNode() (models.AlertQuery, error) {
	ds, err := expr.DataSourceModelFromNodeType(expr.TypeCMDNode)
	if err != nil {
		return models.AlertQuery{}, err
	}

	model := ThresholdQueryModel{
		CommonQueryModel: CommonQueryModel{
			Datasource: *ds,
			RefID:      thresholdRefID,
			Type:       expr.QueryTypeThreshold,
		},
		ThresholdQuery: expr.ThresholdQuery{
			Expression: prometheusMathRefID,
			Conditions: []expr.ThresholdConditionJSON{
				{
					Evaluator: expr.ConditionEvalJSON{
						Type:   expr.ThresholdIsAbove,
						Params: []float64{0},
					},
				},
			},
		},
	}

	return createAlertQueryWithDefaults(expr.DatasourceUID, model, thresholdRefID, nil, string(expr.QueryTypeThreshold))
}
