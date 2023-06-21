package alerting

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/datasources/permissions"
)

type DashAlertExtractor interface {
	GetAlerts(ctx context.Context, dashAlertInfo DashAlertInfo) ([]*models.Alert, error)
	ValidateAlerts(ctx context.Context, dashAlertInfo DashAlertInfo) error
}

// DashAlertExtractorService extracts alerts from the dashboard json.
type DashAlertExtractorService struct {
	datasourcePermissionsService permissions.DatasourcePermissionsService
	datasourceService            datasources.DataSourceService
	alertStore                   AlertStore
	log                          log.Logger
}

func ProvideDashAlertExtractorService(datasourcePermissionsService permissions.DatasourcePermissionsService, datasourceService datasources.DataSourceService, store AlertStore) *DashAlertExtractorService {
	return &DashAlertExtractorService{
		datasourcePermissionsService: datasourcePermissionsService,
		datasourceService:            datasourceService,
		alertStore:                   store,
		log:                          log.New("alerting.extractor"),
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

// UAEnabled takes a context and returns true if Unified Alerting is enabled
// and false if it is disabled or the setting is not present in the context
type uaEnabledKeyType string

const uaEnabledKey uaEnabledKeyType = "unified_alerting_enabled"

func WithUAEnabled(ctx context.Context, enabled bool) context.Context {
	retCtx := context.WithValue(ctx, uaEnabledKey, enabled)
	return retCtx
}

func UAEnabled(ctx context.Context) bool {
	enabled, ok := ctx.Value(uaEnabledKey).(bool)
	if !ok {
		return false
	}
	return enabled
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
				var reason string
				if UAEnabled(ctx) {
					reason = fmt.Sprintf("Alert on PanelId: %v refers to query(%s) that cannot be found. Legacy alerting queries are not able to be removed at this time in order to preserve the ability to rollback to previous versions of Grafana", alert.PanelID, queryRefID)
				} else {
					reason = fmt.Sprintf("Alert on PanelId: %v refers to query(%s) that cannot be found", alert.PanelID, queryRefID)
				}
				return nil, ValidationError{Reason: reason}
			}

			datasource, err := e.lookupQueryDataSource(ctx, panel, panelQuery, dashAlertInfo.OrgID)
			if err != nil {
				return nil, err
			}

			dsFilterQuery := datasources.DatasourcesPermissionFilterQuery{
				User:        dashAlertInfo.User,
				Datasources: []*datasources.DataSource{datasource},
			}

			dataSources, err := e.datasourcePermissionsService.FilterDatasourcesBasedOnQueryPermissions(ctx, &dsFilterQuery)
			if err != nil {
				if !errors.Is(err, permissions.ErrNotImplemented) {
					return nil, err
				}
			} else if len(dataSources) == 0 {
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
		_, err = NewRuleFromDBAlert(ctx, e.alertStore, alert, logTranslationFailures)
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
