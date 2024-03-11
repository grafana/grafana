package extractor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"regexp"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/datasources/guardian"
	"github.com/grafana/grafana/pkg/services/tag"
)

var (
	valueFormatRegex = regexp.MustCompile(`^\d+`)
	isDigitRegex     = regexp.MustCompile(`^[0-9]+$`)
	unitFormatRegex  = regexp.MustCompile(`[a-z]+`)
)

var (
	unitMultiplier = map[string]int{
		"s": 1,
		"m": 60,
		"h": 3600,
		"d": 86400,
	}
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

type DashAlertInfo struct {
	User  identity.Requester
	Dash  *dashboards.Dashboard
	OrgID int64
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

type DashAlertExtractor interface {
	GetAlerts(ctx context.Context, dashAlertInfo DashAlertInfo) ([]*models.Alert, error)
	ValidateAlerts(ctx context.Context, dashAlertInfo DashAlertInfo) error
}

// DashAlertExtractorService extracts alerts from the dashboard json.
type DashAlertExtractorService struct {
	dsGuardian        guardian.DatasourceGuardianProvider
	datasourceService datasources.DataSourceService
	log               log.Logger
}

func ProvideDashAlertExtractorService(dsGuardian guardian.DatasourceGuardianProvider, datasourceService datasources.DataSourceService) *DashAlertExtractorService {
	return &DashAlertExtractorService{
		dsGuardian:        dsGuardian,
		datasourceService: datasourceService,
		log:               log.New("alerting.extractor"),
	}
}

func (e *DashAlertExtractorService) lookupQueryDataSource(ctx context.Context, panel *simplejson.Json, panelQuery *simplejson.Json, orgID int64) (*datasources.DataSource, error) {
	dsName := ""
	dsUid := ""

	ds, ok := panelQuery.CheckGet("datasource")

	if !ok {
		ds = panel.Get("datasource")
	}

	if name, err := ds.String(); err == nil {
		dsName = name
	} else if uid, ok := ds.CheckGet("uid"); ok {
		dsUid = uid.MustString()
	}

	if dsName == "" && dsUid == "" {
		query := &datasources.GetDefaultDataSourceQuery{OrgID: orgID}
		dataSource, err := e.datasourceService.GetDefaultDataSource(ctx, query)
		if err != nil {
			return nil, err
		}
		return dataSource, nil
	}

	query := &datasources.GetDataSourceQuery{Name: dsName, UID: dsUid, OrgID: orgID}
	dataSource, err := e.datasourceService.GetDataSource(ctx, query)
	if err != nil {
		return nil, err
	}

	return dataSource, nil
}

func findPanelQueryByRefID(panel *simplejson.Json, refID string) *simplejson.Json {
	for _, targetsObj := range panel.Get("targets").MustArray() {
		target := simplejson.NewFromAny(targetsObj)

		if target.Get("refId").MustString() == refID {
			return target
		}
	}
	return nil
}

func copyJSON(in json.Marshaler) (*simplejson.Json, error) {
	rawJSON, err := in.MarshalJSON()
	if err != nil {
		return nil, fmt.Errorf("JSON marshaling failed: %w", err)
	}

	return simplejson.NewJson(rawJSON)
}

func (e *DashAlertExtractorService) getAlertFromPanels(ctx context.Context, jsonWithPanels *simplejson.Json, validateAlertFunc func(*models.Alert) error, logTranslationFailures bool, dashAlertInfo DashAlertInfo) ([]*models.Alert, error) {
	ret := make([]*models.Alert, 0)

	for _, panelObj := range jsonWithPanels.Get("panels").MustArray() {
		panel := simplejson.NewFromAny(panelObj)

		collapsedJSON, collapsed := panel.CheckGet("collapsed")
		// check if the panel is collapsed
		if collapsed && collapsedJSON.MustBool() {
			// extract alerts from sub panels for collapsed panels
			alertSlice, err := e.getAlertFromPanels(ctx, panel, validateAlertFunc, logTranslationFailures, dashAlertInfo)
			if err != nil {
				return nil, err
			}

			ret = append(ret, alertSlice...)
			continue
		}

		jsonAlert, hasAlert := panel.CheckGet("alert")

		if !hasAlert {
			continue
		}

		panelID, err := panel.Get("id").Int64()
		if err != nil {
			return nil, ValidationError{Reason: "A numeric panel id property is missing"}
		}

		addIdentifiersToValidationError := func(err error) error {
			if err == nil {
				return nil
			}

			var validationErr ValidationError
			if ok := errors.As(err, &validationErr); ok {
				ve := ValidationError{
					Reason:  validationErr.Reason,
					Err:     validationErr.Err,
					PanelID: panelID,
				}
				if dashAlertInfo.Dash != nil {
					ve.DashboardID = dashAlertInfo.Dash.ID
				}
				return ve
			}
			return err
		}

		// backward compatibility check, can be removed later
		enabled, hasEnabled := jsonAlert.CheckGet("enabled")
		if hasEnabled && !enabled.MustBool() {
			continue
		}

		frequency, err := getTimeDurationStringToSeconds(jsonAlert.Get("frequency").MustString())
		if err != nil {
			return nil, addIdentifiersToValidationError(ValidationError{Reason: err.Error()})
		}

		rawFor := jsonAlert.Get("for").MustString()

		forValue, err := getForValue(rawFor)
		if err != nil {
			return nil, addIdentifiersToValidationError(err)
		}

		alert := &models.Alert{
			DashboardID: dashAlertInfo.Dash.ID,
			OrgID:       dashAlertInfo.OrgID,
			PanelID:     panelID,
			ID:          jsonAlert.Get("id").MustInt64(),
			Name:        jsonAlert.Get("name").MustString(),
			Handler:     jsonAlert.Get("handler").MustInt64(),
			Message:     jsonAlert.Get("message").MustString(),
			Frequency:   frequency,
			For:         forValue,
		}

		for _, condition := range jsonAlert.Get("conditions").MustArray() {
			jsonCondition := simplejson.NewFromAny(condition)

			jsonQuery := jsonCondition.Get("query")
			queryRefID := jsonQuery.Get("params").MustArray()[0].(string)
			panelQuery := findPanelQueryByRefID(panel, queryRefID)

			if panelQuery == nil {
				reason := fmt.Sprintf("Alert on PanelId: %v refers to query(%s) that cannot be found. Legacy alerting queries are not able to be removed at this time in order to preserve the ability to rollback to previous versions of Grafana", alert.PanelID, queryRefID)
				return nil, ValidationError{Reason: reason}
			}

			datasource, err := e.lookupQueryDataSource(ctx, panel, panelQuery, dashAlertInfo.OrgID)
			if err != nil {
				return nil, err
			}

			canQuery, err := e.dsGuardian.New(dashAlertInfo.OrgID, dashAlertInfo.User, *datasource).CanQuery(datasource.ID)
			if err != nil {
				return nil, err
			} else if !canQuery {
				return nil, datasources.ErrDataSourceAccessDenied
			}

			jsonQuery.SetPath([]string{"datasourceId"}, datasource.ID)

			if interval, err := panel.Get("interval").String(); err == nil {
				panelQuery.Set("interval", interval)
			}

			jsonQuery.Set("model", panelQuery.Interface())
		}

		alert.Settings = jsonAlert

		// validate
		_, err = NewRuleFromDBAlert(ctx, alert, logTranslationFailures)
		if err != nil {
			return nil, err
		}

		if err := validateAlertFunc(alert); err != nil {
			return nil, err
		}

		ret = append(ret, alert)
	}

	return ret, nil
}

func validateAlertRule(alert *models.Alert) error {
	if !alert.ValidDashboardPanel() {
		return ValidationError{Reason: fmt.Sprintf("Panel id is not correct, alertName=%v, panelId=%v", alert.Name, alert.PanelID)}
	}
	if !alert.ValidTags() {
		return ValidationError{Reason: "Invalid tags, must be less than 100 characters"}
	}
	return nil
}

// GetAlerts extracts alerts from the dashboard json and does full validation on the alert json data.
func (e *DashAlertExtractorService) GetAlerts(ctx context.Context, dashAlertInfo DashAlertInfo) ([]*models.Alert, error) {
	return e.extractAlerts(ctx, validateAlertRule, true, dashAlertInfo)
}

func (e *DashAlertExtractorService) extractAlerts(ctx context.Context, validateFunc func(alert *models.Alert) error, logTranslationFailures bool, dashAlertInfo DashAlertInfo) ([]*models.Alert, error) {
	dashboardJSON, err := copyJSON(dashAlertInfo.Dash.Data)
	if err != nil {
		return nil, err
	}

	alerts := make([]*models.Alert, 0)

	// We extract alerts from rows to be backwards compatible
	// with the old dashboard json model.
	rows := dashboardJSON.Get("rows").MustArray()
	if len(rows) > 0 {
		for _, rowObj := range rows {
			row := simplejson.NewFromAny(rowObj)
			a, err := e.getAlertFromPanels(ctx, row, validateFunc, logTranslationFailures, dashAlertInfo)
			if err != nil {
				return nil, err
			}

			alerts = append(alerts, a...)
		}
	} else {
		a, err := e.getAlertFromPanels(ctx, dashboardJSON, validateFunc, logTranslationFailures, dashAlertInfo)
		if err != nil {
			return nil, err
		}

		alerts = append(alerts, a...)
	}

	e.log.Debug("Extracted alerts from dashboard", "alertCount", len(alerts))
	return alerts, nil
}

// ValidateAlerts validates alerts in the dashboard json but does not require a valid dashboard id
// in the first validation pass.
func (e *DashAlertExtractorService) ValidateAlerts(ctx context.Context, dashAlertInfo DashAlertInfo) error {
	_, err := e.extractAlerts(ctx, func(alert *models.Alert) error {
		if alert.OrgID == 0 || alert.PanelID == 0 {
			return errors.New("missing OrgId, PanelId or both")
		}
		return nil
	}, false, dashAlertInfo)
	return err
}

// NewRuleFromDBAlert maps a db version of
// alert to an in-memory version.
func NewRuleFromDBAlert(ctx context.Context, ruleDef *models.Alert, logTranslationFailures bool) (*Rule, error) {
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
