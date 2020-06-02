package alerting

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

var (
	// ErrFrequencyCannotBeZeroOrLess frequency cannot be below zero
	ErrFrequencyCannotBeZeroOrLess = errors.New(`"evaluate every" cannot be zero or below`)

	// ErrFrequencyCouldNotBeParsed frequency cannot be parsed
	ErrFrequencyCouldNotBeParsed = errors.New(`"evaluate every" field could not be parsed`)
)

// Rule is the in-memory version of an alert rule.
type Rule struct {
	ID                  int64
	OrgID               int64
	DashboardID         int64
	PanelID             int64
	Frequency           int64
	Name                string
	Message             string
	LastStateChange     time.Time
	For                 time.Duration
	NoDataState         models.NoDataOption
	ExecutionErrorState models.ExecutionErrorOption
	State               models.AlertStateType
	Conditions          []Condition
	Notifications       []string
	AlertRuleTags       []*models.Tag

	StateChanges int64
}

// ValidationError is a typed error with meta data
// about the validation error.
type ValidationError struct {
	Reason      string
	Err         error
	AlertID     int64
	DashboardID int64
	PanelID     int64
}

func (e ValidationError) Error() string {
	extraInfo := e.Reason
	if e.AlertID != 0 {
		extraInfo = fmt.Sprintf("%s AlertId: %v", extraInfo, e.AlertID)
	}

	if e.PanelID != 0 {
		extraInfo = fmt.Sprintf("%s PanelId: %v", extraInfo, e.PanelID)
	}

	if e.DashboardID != 0 {
		extraInfo = fmt.Sprintf("%s DashboardId: %v", extraInfo, e.DashboardID)
	}

	if e.Err != nil {
		return fmt.Sprintf("Alert validation error: %s%s", e.Err.Error(), extraInfo)
	}

	return fmt.Sprintf("Alert validation error: %s", extraInfo)
}

var (
	valueFormatRegex = regexp.MustCompile(`^\d+`)
	unitFormatRegex  = regexp.MustCompile(`\w{1}$`)
)

var unitMultiplier = map[string]int{
	"s": 1,
	"m": 60,
	"h": 3600,
	"d": 86400,
}

func getTimeDurationStringToSeconds(str string) (int64, error) {
	multiplier := 1

	matches := valueFormatRegex.FindAllString(str, 1)

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

	unit := unitFormatRegex.FindAllString(str, 1)[0]

	if val, ok := unitMultiplier[unit]; ok {
		multiplier = val
	}

	return int64(value * multiplier), nil
}

// NewRuleFromDBAlert maps a db version of
// alert to an in-memory version.
func NewRuleFromDBAlert(ruleDef *models.Alert) (*Rule, error) {
	model := &Rule{}
	model.ID = ruleDef.Id
	model.OrgID = ruleDef.OrgId
	model.DashboardID = ruleDef.DashboardId
	model.PanelID = ruleDef.PanelId
	model.Name = ruleDef.Name
	model.Message = ruleDef.Message
	model.State = ruleDef.State
	model.LastStateChange = ruleDef.NewStateDate
	model.For = ruleDef.For
	model.NoDataState = models.NoDataOption(ruleDef.Settings.Get("noDataState").MustString("no_data"))
	model.ExecutionErrorState = models.ExecutionErrorOption(ruleDef.Settings.Get("executionErrorState").MustString("alerting"))
	model.StateChanges = ruleDef.StateChanges

	model.Frequency = ruleDef.Frequency
	// frequency cannot be zero since that would not execute the alert rule.
	// so we fallback to 60 seconds if `Frequency` is missing
	if model.Frequency == 0 {
		model.Frequency = 60
	}

	for _, v := range ruleDef.Settings.Get("notifications").MustArray() {
		jsonModel := simplejson.NewFromAny(v)
		if id, err := jsonModel.Get("id").Int64(); err == nil {
			uid, err := translateNotificationIDToUID(id, ruleDef.OrgId)
			if err != nil {
				logger.Error("Unable to translate notification id to uid", "error", err.Error(), "dashboardId", model.DashboardID, "alertId", model.ID, "panelId", model.PanelID, "notificationId", id)
			} else {
				model.Notifications = append(model.Notifications, uid)
			}
		} else if uid, err := jsonModel.Get("uid").String(); err == nil {
			model.Notifications = append(model.Notifications, uid)
		} else {
			return nil, ValidationError{Reason: "Neither id nor uid is specified in 'notifications' block, " + err.Error(), DashboardID: model.DashboardID, AlertID: model.ID, PanelID: model.PanelID}
		}
	}
	model.AlertRuleTags = ruleDef.GetTagsFromSettings()

	for index, condition := range ruleDef.Settings.Get("conditions").MustArray() {
		conditionModel := simplejson.NewFromAny(condition)
		conditionType := conditionModel.Get("type").MustString()
		factory, exist := conditionFactories[conditionType]
		if !exist {
			return nil, ValidationError{Reason: "Unknown alert condition: " + conditionType, DashboardID: model.DashboardID, AlertID: model.ID, PanelID: model.PanelID}
		}
		queryCondition, err := factory(conditionModel, index)
		if err != nil {
			return nil, ValidationError{Err: err, DashboardID: model.DashboardID, AlertID: model.ID, PanelID: model.PanelID}
		}
		model.Conditions = append(model.Conditions, queryCondition)
	}

	if len(model.Conditions) == 0 {
		return nil, ValidationError{Reason: "Alert is missing conditions"}
	}

	return model, nil
}

func translateNotificationIDToUID(id int64, orgID int64) (string, error) {
	notificationUID, err := getAlertNotificationUIDByIDAndOrgID(id, orgID)
	if err != nil {
		logger.Debug("Failed to translate Notification Id to Uid", "orgID", orgID, "Id", id)
		return "", err
	}

	return notificationUID, nil
}

func getAlertNotificationUIDByIDAndOrgID(notificationID int64, orgID int64) (string, error) {
	query := &models.GetAlertNotificationUidQuery{
		OrgId: orgID,
		Id:    notificationID,
	}

	if err := bus.Dispatch(query); err != nil {
		return "", err
	}

	return query.Result, nil
}

// ConditionFactory is the function signature for creating `Conditions`.
type ConditionFactory func(model *simplejson.Json, index int) (Condition, error)

var conditionFactories = make(map[string]ConditionFactory)

// RegisterCondition adds support for alerting conditions.
func RegisterCondition(typeName string, factory ConditionFactory) {
	conditionFactories[typeName] = factory
}
