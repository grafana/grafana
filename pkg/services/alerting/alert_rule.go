package alerting

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting/transformers"

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
	Transformer     transformers.Transformer

	NotificationGroups []int64
}

var (
	ValueFormatRegex = regexp.MustCompile("^\\d+")
	UnitFormatRegex  = regexp.MustCompile("\\w{1}$")
)

var unitMultiplier = map[string]int{
	"s": 1,
	"m": 60,
	"h": 3600,
}

func getTimeDurationStringToSeconds(str string) int64 {
	multiplier := 1

	value, _ := strconv.Atoi(ValueFormatRegex.FindAllString(str, 1)[0])
	unit := UnitFormatRegex.FindAllString(str, 1)[0]

	if val, ok := unitMultiplier[unit]; ok {
		multiplier = val
	}

	return int64(value * multiplier)
}

func NewAlertRuleFromDBModel(ruleDef *m.Alert) (*AlertRule, error) {
	model := &AlertRule{}
	model.Id = ruleDef.Id
	model.OrgId = ruleDef.OrgId
	model.Name = ruleDef.Name
	model.Description = ruleDef.Description
	model.State = ruleDef.State
	model.Frequency = ruleDef.Frequency

	ngs := ruleDef.Settings.Get("notificationGroups").MustString()
	var ids []int64
	for _, v := range strings.Split(ngs, ",") {
		id, err := strconv.Atoi(v)
		if err == nil {
			ids = append(ids, int64(id))
		}
	}

	model.NotificationGroups = ids

	critical := ruleDef.Settings.Get("crit")
	model.Critical = Level{
		Operator: critical.Get("op").MustString(),
		Value:    critical.Get("value").MustFloat64(),
	}

	warning := ruleDef.Settings.Get("warn")
	model.Warning = Level{
		Operator: warning.Get("op").MustString(),
		Value:    warning.Get("value").MustFloat64(),
	}

	model.Transform = ruleDef.Settings.Get("transform").Get("type").MustString()
	if model.Transform == "" {
		return nil, fmt.Errorf("missing transform")
	}

	model.TransformParams = *ruleDef.Settings.Get("transform")

	if model.Transform == "aggregation" {
		method := ruleDef.Settings.Get("transform").Get("method").MustString()
		model.Transformer = transformers.NewAggregationTransformer(method)
	}

	query := ruleDef.Settings.Get("query")
	model.Query = AlertQuery{
		Query:        query.Get("query").MustString(),
		DatasourceId: query.Get("datasourceId").MustInt64(),
		From:         query.Get("from").MustString(),
		To:           query.Get("to").MustString(),
	}

	if model.Query.Query == "" {
		return nil, fmt.Errorf("missing query.query")
	}

	if model.Query.DatasourceId == 0 {
		return nil, fmt.Errorf("missing query.datasourceId")
	}

	return model, nil
}
