package alerting

import (
	"fmt"
	"regexp"
	"strconv"

	"github.com/grafana/grafana/pkg/components/simplejson"

	m "github.com/grafana/grafana/pkg/models"
)

type AlertRule struct {
	Id            int64
	OrgId         int64
	DashboardId   int64
	PanelId       int64
	Frequency     int64
	Name          string
	Description   string
	Severity      string
	Conditions    []AlertCondition
	Notifications []int64
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
	model.Frequency = ruleDef.Frequency
	model.Severity = ruleDef.Severity

	for _, v := range ruleDef.Settings.Get("notifications").MustArray() {
		if id, ok := v.(int64); ok {
			model.Notifications = append(model.Notifications, int64(id))
		}
	}

	for _, condition := range ruleDef.Settings.Get("conditions").MustArray() {
		conditionModel := simplejson.NewFromAny(condition)
		switch conditionModel.Get("type").MustString() {
		case "query":
			queryCondition, err := NewQueryCondition(conditionModel)
			if err != nil {
				return nil, err
			}
			model.Conditions = append(model.Conditions, queryCondition)
		}
	}

	if len(model.Conditions) == 0 {
		return nil, fmt.Errorf("Alert is missing conditions")
	}

	return model, nil
}
