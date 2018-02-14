package alerting

import (
	"fmt"
	"regexp"
	"strconv"

	"github.com/grafana/grafana/pkg/components/simplejson"

	m "github.com/grafana/grafana/pkg/models"
)

type Rule struct {
	Id                  int64
	OrgId               int64
	DashboardId         int64
	PanelId             int64
	Frequency           int64
	Name                string
	Message             string
	NoDataState         m.NoDataOption
	ExecutionErrorState m.ExecutionErrorOption
	State               m.AlertStateType
	Conditions          []Condition
	Notifications       []int64
	ExternalTags        map[string]string
}

type ValidationError struct {
	Reason      string
	Err         error
	Alertid     int64
	DashboardId int64
	PanelId     int64
}

func (e ValidationError) Error() string {
	extraInfo := ""
	if e.Alertid != 0 {
		extraInfo = fmt.Sprintf("%s AlertId: %v", extraInfo, e.Alertid)
	}

	if e.PanelId != 0 {
		extraInfo = fmt.Sprintf("%s PanelId: %v ", extraInfo, e.PanelId)
	}

	if e.DashboardId != 0 {
		extraInfo = fmt.Sprintf("%s DashboardId: %v", extraInfo, e.DashboardId)
	}

	if e.Err != nil {
		return fmt.Sprintf("%s %s%s", e.Err.Error(), e.Reason, extraInfo)
	}

	return fmt.Sprintf("Failed to extract alert.Reason: %s %s", e.Reason, extraInfo)
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

func getTimeDurationStringToSeconds(str string) (int64, error) {
	multiplier := 1

	matches := ValueFormatRegex.FindAllString(str, 1)

	if len(matches) <= 0 {
		return 0, fmt.Errorf("Frequency could not be parsed")
	}

	value, err := strconv.Atoi(matches[0])
	if err != nil {
		return 0, err
	}

	unit := UnitFormatRegex.FindAllString(str, 1)[0]

	if val, ok := unitMultiplier[unit]; ok {
		multiplier = val
	}

	return int64(value * multiplier), nil
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
	model.State = ruleDef.State
	model.NoDataState = m.NoDataOption(ruleDef.Settings.Get("noDataState").MustString("no_data"))
	model.ExecutionErrorState = m.ExecutionErrorOption(ruleDef.Settings.Get("executionErrorState").MustString("alerting"))

	for _, v := range ruleDef.Settings.Get("notifications").MustArray() {
		jsonModel := simplejson.NewFromAny(v)
		if id, err := jsonModel.Get("id").Int64(); err != nil {
			return nil, ValidationError{Reason: "Invalid notification schema", DashboardId: model.DashboardId, Alertid: model.Id, PanelId: model.PanelId}
		} else {
			model.Notifications = append(model.Notifications, id)
		}
	}
	model.ExternalTags = map[string]string{}
	for tagName, tagValue := range ruleDef.Settings.Get("externalTags").MustMap() {
		model.ExternalTags[tagName] = tagValue.(string)
	}

	for index, condition := range ruleDef.Settings.Get("conditions").MustArray() {
		conditionModel := simplejson.NewFromAny(condition)
		conditionType := conditionModel.Get("type").MustString()
		if factory, exist := conditionFactories[conditionType]; !exist {
			return nil, ValidationError{Reason: "Unknown alert condition: " + conditionType, DashboardId: model.DashboardId, Alertid: model.Id, PanelId: model.PanelId}
		} else {
			if queryCondition, err := factory(conditionModel, index); err != nil {
				return nil, ValidationError{Err: err, DashboardId: model.DashboardId, Alertid: model.Id, PanelId: model.PanelId}
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
