package alerting

import (
	"fmt"
	"regexp"
	"strconv"

	"github.com/grafana/grafana/pkg/components/simplejson"

	m "github.com/grafana/grafana/pkg/models"
)

type Rule struct {
	Id            int64
	OrgId         int64
	DashboardId   int64
	PanelId       int64
	Frequency     int64
	Name          string
	Message       string
	State         m.AlertStateType
	Severity      m.AlertSeverityType
	Conditions    []Condition
	Notifications []int64
}

type ValidationError struct {
	Reason string
}

func (e ValidationError) Error() string {
	return e.Reason
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

func NewRuleFromDBAlert(ruleDef *m.Alert) (*Rule, error) {
	model := &Rule{}
	model.Id = ruleDef.Id
	model.OrgId = ruleDef.OrgId
	model.DashboardId = ruleDef.DashboardId
	model.PanelId = ruleDef.PanelId
	model.Name = ruleDef.Name
	model.Message = ruleDef.Message
	model.Frequency = ruleDef.Frequency
	model.Severity = ruleDef.Severity
	model.State = ruleDef.State

	for _, v := range ruleDef.Settings.Get("notifications").MustArray() {
		jsonModel := simplejson.NewFromAny(v)
		if id, err := jsonModel.Get("id").Int64(); err != nil {
			return nil, ValidationError{Reason: "Invalid notification schema"}
		} else {
			model.Notifications = append(model.Notifications, id)
		}
	}

	for index, condition := range ruleDef.Settings.Get("conditions").MustArray() {
		conditionModel := simplejson.NewFromAny(condition)
		conditionType := conditionModel.Get("type").MustString()
		if factory, exist := conditionFactories[conditionType]; !exist {
			return nil, ValidationError{Reason: "Unknown alert condition: " + conditionType}
		} else {
			if queryCondition, err := factory(conditionModel, index); err != nil {
				return nil, err
			} else {
				model.Conditions = append(model.Conditions, queryCondition)
			}
		}
	}

	if len(model.Conditions) == 0 {
		return nil, fmt.Errorf("Alert is missing conditions")
	}

	return model, nil
}

type ConditionFactory func(model *simplejson.Json, index int) (Condition, error)

var conditionFactories map[string]ConditionFactory = make(map[string]ConditionFactory)

func RegisterCondition(typeName string, factory ConditionFactory) {
	conditionFactories[typeName] = factory
}
