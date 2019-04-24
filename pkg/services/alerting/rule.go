package alerting

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
)

var (
	ErrFrequencyCannotBeZeroOrLess = errors.New(`"evaluate every" cannot be zero or below`)
	ErrFrequencyCouldNotBeParsed   = errors.New(`"evaluate every" field could not be parsed`)
)

type Rule struct {
	Id                  int64
	OrgId               int64
	DashboardId         int64
	PanelId             int64
	Frequency           int64
	Name                string
	Message             string
	LastStateChange     time.Time
	For                 time.Duration
	NoDataState         m.NoDataOption
	ExecutionErrorState m.ExecutionErrorOption
	State               m.AlertStateType
	Conditions          []Condition
	Notifications       []string

	StateChanges int64
}

type ValidationError struct {
	Reason      string
	Err         error
	Alertid     int64
	DashboardId int64
	PanelId     int64
}

func (e ValidationError) Error() string {
	extraInfo := e.Reason
	if e.Alertid != 0 {
		extraInfo = fmt.Sprintf("%s AlertId: %v", extraInfo, e.Alertid)
	}

	if e.PanelId != 0 {
		extraInfo = fmt.Sprintf("%s PanelId: %v", extraInfo, e.PanelId)
	}

	if e.DashboardId != 0 {
		extraInfo = fmt.Sprintf("%s DashboardId: %v", extraInfo, e.DashboardId)
	}

	if e.Err != nil {
		return fmt.Sprintf("Alert validation error: %s%s", e.Err.Error(), extraInfo)
	}

	return fmt.Sprintf("Alert validation error: %s", extraInfo)
}

var (
	ValueFormatRegex = regexp.MustCompile(`^\d+`)
	UnitFormatRegex  = regexp.MustCompile(`\w{1}$`)
)

var unitMultiplier = map[string]int{
	"s": 1,
	"m": 60,
	"h": 3600,
	"d": 86400,
}

func getTimeDurationStringToSeconds(str string) (int64, error) {
	multiplier := 1

	matches := ValueFormatRegex.FindAllString(str, 1)

	if len(matches) <= 0 {
		return 0, ErrFrequencyCouldNotBeParsed
	}

	value, err := strconv.Atoi(matches[0])
	if err != nil {
		return 0, err
	}

	if value == 0 {
		return 0, ErrFrequencyCannotBeZeroOrLess
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
	model.State = ruleDef.State
	model.LastStateChange = ruleDef.NewStateDate
	model.For = ruleDef.For
	model.NoDataState = m.NoDataOption(ruleDef.Settings.Get("noDataState").MustString("no_data"))
	model.ExecutionErrorState = m.ExecutionErrorOption(ruleDef.Settings.Get("executionErrorState").MustString("alerting"))
	model.StateChanges = ruleDef.StateChanges

	model.Frequency = ruleDef.Frequency
	// frequency cannot be zero since that would not execute the alert rule.
	// so we fallback to 60 seconds if `Freqency` is missing
	if model.Frequency == 0 {
		model.Frequency = 60
	}

	for _, v := range ruleDef.Settings.Get("notifications").MustArray() {
		jsonModel := simplejson.NewFromAny(v)
		if id, err := jsonModel.Get("id").Int64(); err == nil {
			model.Notifications = append(model.Notifications, fmt.Sprintf("%09d", id))
		} else {
			uid, err := jsonModel.Get("uid").String()
			if err != nil {
				return nil, ValidationError{Reason: "Neither id nor uid is specified, " + err.Error(), DashboardId: model.DashboardId, Alertid: model.Id, PanelId: model.PanelId}
			}
			model.Notifications = append(model.Notifications, uid)
		}
	}

	for index, condition := range ruleDef.Settings.Get("conditions").MustArray() {
		conditionModel := simplejson.NewFromAny(condition)
		conditionType := conditionModel.Get("type").MustString()
		factory, exist := conditionFactories[conditionType]
		if !exist {
			return nil, ValidationError{Reason: "Unknown alert condition: " + conditionType, DashboardId: model.DashboardId, Alertid: model.Id, PanelId: model.PanelId}
		}
		queryCondition, err := factory(conditionModel, index)
		if err != nil {
			return nil, ValidationError{Err: err, DashboardId: model.DashboardId, Alertid: model.Id, PanelId: model.PanelId}
		}
		model.Conditions = append(model.Conditions, queryCondition)
	}

	if len(model.Conditions) == 0 {
		return nil, ValidationError{Reason: "Alert is missing conditions"}
	}

	return model, nil
}

type ConditionFactory func(model *simplejson.Json, index int) (Condition, error)

var conditionFactories = make(map[string]ConditionFactory)

func RegisterCondition(typeName string, factory ConditionFactory) {
	conditionFactories[typeName] = factory
}
