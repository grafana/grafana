package alerting

import (
	"fmt"

	"github.com/grafana/grafana/pkg/components/simplejson"

	m "github.com/grafana/grafana/pkg/models"
)

type AlertRule struct {
	Id              int64
	OrgId           int64
	DashboardId     int64
	PanelId         int64
	Frequency       int64
	Name            string
	Description     string
	State           string
	Warning         Level
	Critical        Level
	Query           AlertQuery
	Transform       string
	TransformParams simplejson.Json
	Transformer     Transformer
}

func getTimeDurationStringToSeconds(str string) int64 {
	return 60
}

func NewAlertRuleFromDBModel(ruleDef *m.Alert) (*AlertRule, error) {
	model := &AlertRule{}
	model.Id = ruleDef.Id
	model.OrgId = ruleDef.OrgId
	model.Name = ruleDef.Name
	model.Description = ruleDef.Description
	model.State = ruleDef.State

	critical := ruleDef.Expression.Get("critical")
	model.Critical = Level{
		Operator: critical.Get("op").MustString(),
		Level:    critical.Get("level").MustFloat64(),
	}

	warning := ruleDef.Expression.Get("warn")
	model.Warning = Level{
		Operator: warning.Get("op").MustString(),
		Level:    warning.Get("level").MustFloat64(),
	}

	model.Frequency = getTimeDurationStringToSeconds(ruleDef.Expression.Get("frequency").MustString())
	model.Transform = ruleDef.Expression.Get("transform").Get("type").MustString()
	model.TransformParams = *ruleDef.Expression.Get("transform")

	if model.Transform == "aggregation" {
		model.Transformer = &AggregationTransformer{
			Method: ruleDef.Expression.Get("transform").Get("method").MustString(),
		}
	}

	query := ruleDef.Expression.Get("query")
	model.Query = AlertQuery{
		Query:        query.Get("query").MustString(),
		DatasourceId: query.Get("datasourceId").MustInt64(),
		From:         query.Get("from").MustString(),
		To:           query.Get("to").MustString(),
		Aggregator:   query.Get("agg").MustString(),
	}

	if model.Query.Query == "" {
		return nil, fmt.Errorf("missing query.query")
	}

	if model.Query.DatasourceId == 0 {
		return nil, fmt.Errorf("missing query.datasourceId")
	}

	return model, nil
}
