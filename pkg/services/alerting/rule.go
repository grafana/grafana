package alerting

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"regexp"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/tag"
)

var unitMultiplier = map[string]int{
	"s": 1,
	"m": 60,
	"h": 3600,
	"d": 86400,
}

var (
	valueFormatRegex = regexp.MustCompile(`^\d+`)
	isDigitRegex     = regexp.MustCompile(`^[0-9]+$`)
	unitFormatRegex  = regexp.MustCompile(`[a-z]+`)
)

var (
	// ErrFrequencyCannotBeZeroOrLess frequency cannot be below zero
	ErrFrequencyCannotBeZeroOrLess = errors.New(`"evaluate every" cannot be zero or below`)

	// ErrFrequencyCouldNotBeParsed frequency cannot be parsed
	ErrFrequencyCouldNotBeParsed = errors.New(`"evaluate every" field could not be parsed`)

	// ErrWrongUnitFormat wrong unit format
	ErrWrongUnitFormat = fmt.Errorf(`time unit not supported. supported units: %s`, reflect.ValueOf(unitMultiplier).MapKeys())
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
	AlertRuleTags       []*tag.Tag

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
		return fmt.Sprintf("alert validation error: %s%s", e.Err.Error(), extraInfo)
	}

	return fmt.Sprintf("alert validation error: %s", extraInfo)
}

func getTimeDurationStringToSeconds(str string) (int64, error) {
	// Check if frequency lacks unit
	if isDigitRegex.MatchString(str) || str == "" {
		return 0, ErrFrequencyCouldNotBeParsed
	}

	unit := unitFormatRegex.FindAllString(str, 1)[0]
	if _, ok := unitMultiplier[unit]; !ok {
		return 0, ErrWrongUnitFormat
	}

	multiplier := unitMultiplier[unit]

	matches := valueFormatRegex.FindAllString(str, 1)

	if len(matches) == 0 {
		return 0, ErrFrequencyCouldNotBeParsed
	}

	value, err := strconv.Atoi(matches[0])
	if err != nil {
		return 0, err
	}

	if value == 0 {
		return 0, ErrFrequencyCannotBeZeroOrLess
	}

	return int64(value * multiplier), nil
}

func getForValue(rawFor string) (time.Duration, error) {
	var forValue time.Duration
	var err error

	if rawFor != "" {
		if rawFor != "0" {
			strings := unitFormatRegex.FindAllString(rawFor, 1)
			if strings == nil {
				return 0, ValidationError{Reason: fmt.Sprintf("no specified unit, error: %s", ErrWrongUnitFormat.Error())}
			}
			if _, ok := unitMultiplier[strings[0]]; !ok {
				return 0, ValidationError{Reason: fmt.Sprintf("could not parse for field, error: %s", ErrWrongUnitFormat.Error())}
			}
		}
		forValue, err = time.ParseDuration(rawFor)
		if err != nil {
			return 0, ValidationError{Reason: "Could not parse for field"}
		}
	}
	return forValue, nil
}

// NewRuleFromDBAlert maps a db version of
// alert to an in-memory version.
func NewRuleFromDBAlert(ctx context.Context, store AlertStore, ruleDef *models.Alert, logTranslationFailures bool) (*Rule, error) {
	model := &Rule{}
	model.ID = ruleDef.ID
	model.OrgID = ruleDef.OrgID
	model.DashboardID = ruleDef.DashboardID
	model.PanelID = ruleDef.PanelID
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
			uid, err := translateNotificationIDToUID(ctx, store, id, ruleDef.OrgID)
			if err != nil {
				if !errors.Is(err, models.ErrAlertNotificationFailedTranslateUniqueID) {
					logger.Error("Failed to translate notification id to uid", "error", err.Error(), "dashboardId", model.DashboardID, "alert", model.Name, "panelId", model.PanelID, "notificationId", id)
				}

				if logTranslationFailures {
					logger.Warn("Unable to translate notification id to uid", "dashboardId", model.DashboardID, "alert", model.Name, "panelId", model.PanelID, "notificationId", id)
				}
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

func translateNotificationIDToUID(ctx context.Context, store AlertStore, id int64, orgID int64) (string, error) {
	notificationUID, err := getAlertNotificationUIDByIDAndOrgID(ctx, store, id, orgID)
	if err != nil {
		return "", err
	}

	return notificationUID, nil
}

func getAlertNotificationUIDByIDAndOrgID(ctx context.Context, store AlertStore, notificationID int64, orgID int64) (string, error) {
	query := &models.GetAlertNotificationUidQuery{
		OrgID: orgID,
		ID:    notificationID,
	}

	uid, err := store.GetAlertNotificationUidWithId(ctx, query)
	if err != nil {
		return "", err
	}

	return uid, nil
}

// ConditionFactory is the function signature for creating `Conditions`.
type ConditionFactory func(model *simplejson.Json, index int) (Condition, error)

var conditionFactories = make(map[string]ConditionFactory)

// RegisterCondition adds support for alerting conditions.
func RegisterCondition(typeName string, factory ConditionFactory) {
	conditionFactories[typeName] = factory
}
