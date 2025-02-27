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

func createQueryNode(datasourceUID, datasourceType, expr string, fromTimeRange, evaluationOffset time.Duration) (models.AlertQuery, error) {
	modelData := map[string]interface{}{
		"datasource": map[string]interface{}{
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

	modelJSON, err := json.Marshal(modelData)
	if err != nil {
		return models.AlertQuery{}, err
	}

	return models.AlertQuery{
		DatasourceUID: datasourceUID,
		Model:         modelJSON,
		RefID:         queryRefID,
		RelativeTimeRange: models.RelativeTimeRange{
			From: models.Duration(fromTimeRange + evaluationOffset),
			To:   models.Duration(0 + evaluationOffset),
		},
	}, nil
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

	modelJSON, err := json.Marshal(model)
	if err != nil {
		return models.AlertQuery{}, err
	}

	return models.AlertQuery{
		DatasourceUID: expr.DatasourceUID,
		Model:         modelJSON,
		RefID:         prometheusMathRefID,
		QueryType:     string(model.Type),
	}, nil
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

	modelJSON, err := json.Marshal(model)
	if err != nil {
		return models.AlertQuery{}, err
	}

	return models.AlertQuery{
		DatasourceUID: expr.DatasourceUID,
		Model:         modelJSON,
		RefID:         thresholdRefID,
		QueryType:     string(model.Type),
	}, nil
}
