package alerting

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

// DashAlertExtractor extracts alerts from the dashboard json.
type DashAlertExtractor struct {
	User  *models.SignedInUser
	Dash  *models.Dashboard
	OrgID int64
	log   log.Logger
}

// NewDashAlertExtractor returns a new DashAlertExtractor.
func NewDashAlertExtractor(dash *models.Dashboard, orgID int64, user *models.SignedInUser) *DashAlertExtractor {
	return &DashAlertExtractor{
		User:  user,
		Dash:  dash,
		OrgID: orgID,
		log:   log.New("alerting.extractor"),
	}
}

func (e *DashAlertExtractor) lookupQueryDataSource(panel *simplejson.Json, panelQuery *simplejson.Json) (*models.DataSource, error) {
	dsName := ""
	dsUid := ""

	datasource, ok := panelQuery.CheckGet("datasource")

	if !ok {
		datasource = panel.Get("datasource")
	}

	if name, err := datasource.String(); err == nil {
		dsName = name
	} else if uid, ok := datasource.CheckGet("uid"); ok {
		dsUid = uid.MustString()
	}

	if dsName == "" && dsUid == "" {
		query := &models.GetDefaultDataSourceQuery{OrgId: e.OrgID}
		if err := bus.DispatchCtx(context.TODO(), query); err != nil {
			return nil, err
		}
		return query.Result, nil
	}

	query := &models.GetDataSourceQuery{Name: dsName, Uid: dsUid, OrgId: e.OrgID}
	if err := bus.DispatchCtx(context.TODO(), query); err != nil {
		return nil, err
	}

	return query.Result, nil
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

func (e *DashAlertExtractor) getAlertFromPanels(ctx context.Context, jsonWithPanels *simplejson.Json, validateAlertFunc func(*models.Alert) bool, logTranslationFailures bool) ([]*models.Alert, error) {
	alerts := make([]*models.Alert, 0)

	for _, panelObj := range jsonWithPanels.Get("panels").MustArray() {
		panel := simplejson.NewFromAny(panelObj)

		collapsedJSON, collapsed := panel.CheckGet("collapsed")
		// check if the panel is collapsed
		if collapsed && collapsedJSON.MustBool() {
			// extract alerts from sub panels for collapsed panels
			alertSlice, err := e.getAlertFromPanels(ctx, panel, validateAlertFunc, logTranslationFailures)
			if err != nil {
				return nil, err
			}

			alerts = append(alerts, alertSlice...)
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
				if e.Dash != nil {
					ve.DashboardID = e.Dash.Id
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
			DashboardId: e.Dash.Id,
			OrgId:       e.OrgID,
			PanelId:     panelID,
			Id:          jsonAlert.Get("id").MustInt64(),
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
				reason := fmt.Sprintf("Alert on PanelId: %v refers to query(%s) that cannot be found", alert.PanelId, queryRefID)
				return nil, ValidationError{Reason: reason}
			}

			datasource, err := e.lookupQueryDataSource(panel, panelQuery)
			if err != nil {
				return nil, err
			}

			dsFilterQuery := models.DatasourcesPermissionFilterQuery{
				User:        e.User,
				Datasources: []*models.DataSource{datasource},
			}

			if err := bus.Dispatch(&dsFilterQuery); err != nil {
				if !errors.Is(err, bus.ErrHandlerNotFound) {
					return nil, err
				}
			} else {
				if len(dsFilterQuery.Result) == 0 {
					return nil, models.ErrDataSourceAccessDenied
				}
			}

			jsonQuery.SetPath([]string{"datasourceId"}, datasource.Id)

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

		if !validateAlertFunc(alert) {
			return nil, ValidationError{Reason: fmt.Sprintf("Panel id is not correct, alertName=%v, panelId=%v", alert.Name, alert.PanelId)}
		}

		alerts = append(alerts, alert)
	}

	return alerts, nil
}

func validateAlertRule(alert *models.Alert) bool {
	return alert.ValidToSave()
}

// GetAlerts extracts alerts from the dashboard json and does full validation on the alert json data.
func (e *DashAlertExtractor) GetAlerts(ctx context.Context) ([]*models.Alert, error) {
	return e.extractAlerts(ctx, validateAlertRule, true)
}

func (e *DashAlertExtractor) extractAlerts(ctx context.Context, validateFunc func(alert *models.Alert) bool, logTranslationFailures bool) ([]*models.Alert, error) {
	dashboardJSON, err := copyJSON(e.Dash.Data)
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
			a, err := e.getAlertFromPanels(ctx, row, validateFunc, logTranslationFailures)
			if err != nil {
				return nil, err
			}

			alerts = append(alerts, a...)
		}
	} else {
		a, err := e.getAlertFromPanels(ctx, dashboardJSON, validateFunc, logTranslationFailures)
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
func (e *DashAlertExtractor) ValidateAlerts(ctx context.Context) error {
	_, err := e.extractAlerts(ctx, func(alert *models.Alert) bool {
		return alert.OrgId != 0 && alert.PanelId != 0
	}, false)
	return err
}
