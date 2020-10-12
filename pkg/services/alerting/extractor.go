package alerting

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

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

func (e *DashAlertExtractor) lookupDatasourceID(dsName string) (*models.DataSource, error) {
	if dsName == "" {
		query := &models.GetDataSourcesQuery{OrgId: e.OrgID}
		if err := bus.Dispatch(query); err != nil {
			return nil, err
		}

		for _, ds := range query.Result {
			if ds.IsDefault {
				return ds, nil
			}
		}
	} else {
		query := &models.GetDataSourceByNameQuery{Name: dsName, OrgId: e.OrgID}
		if err := bus.Dispatch(query); err != nil {
			return nil, err
		}

		return query.Result, nil
	}

	return nil, errors.New("Could not find datasource id for " + dsName)
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
		return nil, err
	}

	return simplejson.NewJson(rawJSON)
}

func (e *DashAlertExtractor) getAlertsFromPanels(jsonWithPanels *simplejson.Json, validators ...alertValidator) ([]*models.Alert, error) {
	alerts := make([]*models.Alert, 0)

	for _, panelObj := range jsonWithPanels.Get("panels").MustArray() {
		panel := simplejson.NewFromAny(panelObj)

		collapsedJSON, collapsed := panel.CheckGet("collapsed")
		// check if the panel is collapsed
		if collapsed && collapsedJSON.MustBool() {
			// extract alerts from sub panels for collapsed panels
			alertSlice, err := e.getAlertsFromPanels(panel, validators...)
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

		// backward compatibility check, can be removed later
		enabled, hasEnabled := jsonAlert.CheckGet("enabled")
		if hasEnabled && !enabled.MustBool() {
			continue
		}

		frequency, err := getTimeDurationStringToSeconds(jsonAlert.Get("frequency").MustString())
		if err != nil {
			return nil, ValidationError{Reason: err.Error()}
		}

		rawFor := jsonAlert.Get("for").MustString()
		var forValue time.Duration
		if rawFor != "" {
			forValue, err = time.ParseDuration(rawFor)
			if err != nil {
				return nil, ValidationError{Reason: "Could not parse for"}
			}
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

			dsName := ""
			if panelQuery.Get("datasource").MustString() != "" {
				dsName = panelQuery.Get("datasource").MustString()
			} else if panel.Get("datasource").MustString() != "" {
				dsName = panel.Get("datasource").MustString()
			}

			datasource, err := e.lookupDatasourceID(dsName)
			if err != nil {
				e.log.Debug("Error looking up datasource", "error", err)
				return nil, ValidationError{Reason: fmt.Sprintf("Data source used by alert rule not found, alertName=%v, datasource=%s", alert.Name, dsName)}
			}

			dsFilterQuery := models.DatasourcesPermissionFilterQuery{
				User:        e.User,
				Datasources: []*models.DataSource{datasource},
			}

			if err := bus.Dispatch(&dsFilterQuery); err != nil {
				if err != bus.ErrHandlerNotFound {
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
		_, err = NewRuleFromDBAlert(alert)
		if err != nil {
			return nil, err
		}

		validationErrors := strings.Builder{}
		validationWarnings := strings.Builder{}
		for _, validator := range validators {
			err := validator.aFunc(alert)
			if err == nil {
				continue
			}

			switch validator.aSeverity {
			case alertError:
				if validationErrors.Len() > 0 {
					validationErrors.WriteString("\n")
				}
				validationErrors.WriteString(err.Error())
			case alertWarning:
				if validationWarnings.Len() > 0 {
					validationWarnings.WriteString("\n")
				}
				validationWarnings.WriteString(err.Error())
			}
		}
		if validationErrors.String() != "" {
			return nil, ValidationError{Reason: validationErrors.String()}
		}
		if validationWarnings.String() != "" {
			e.log.Warn(validationWarnings.String())
		}

		alerts = append(alerts, alert)
	}

	return alerts, nil
}

func validateAlertRule(alert *models.Alert) (err error) {
	if !alert.ValidToSave() {
		err = fmt.Errorf("Dashboard ID, Org ID or Panel ID is not correct, alertName=%v, panelId=%v, orgId=%v, dashboardId=%v", alert.Name, alert.PanelId, alert.OrgId, alert.DashboardId)
	}
	return err
}

func validAlertJSON(alert *models.Alert) (err error) {
	warnings := strings.Builder{}
	for _, v := range alert.Settings.Get("notifications").MustArray() {
		jsonModel := simplejson.NewFromAny(v)
		id, err := jsonModel.Get("id").Int64()
		if err != nil {
			continue
		}

		if _, err := translateNotificationIDToUID(id, alert.OrgId); err == nil {
			continue
		}

		if warnings.Len() > 0 {
			warnings.WriteString("\n")
		}
		warnings.WriteString(fmt.Sprintf("Alert contains notification identified by incorrect ID, alertName=%v, panelId=%v, notificationId=%v", alert.Name, alert.PanelId, id))
	}
	reason := warnings.String()
	if reason != "" {
		err = fmt.Errorf(reason)
	}
	return err
}

// GetAlerts extracts alerts from the dashboard json and does full validation on the alert json data.
func (e *DashAlertExtractor) GetAlerts() ([]*models.Alert, error) {
	validators := []alertValidator{
		{
			aFunc:     validateAlertRule,
			aSeverity: alertError,
		},
		{
			aFunc:     validAlertJSON,
			aSeverity: alertWarning,
		},
	}
	return e.extractAlerts(validators...)
}

func (e *DashAlertExtractor) extractAlerts(validators ...alertValidator) ([]*models.Alert, error) {
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
			a, err := e.getAlertsFromPanels(row, validators...)
			if err != nil {
				return nil, err
			}

			alerts = append(alerts, a...)
		}
	} else {
		a, err := e.getAlertsFromPanels(dashboardJSON, validators...)
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
func (e *DashAlertExtractor) ValidateAlerts() error {
	_, err := e.extractAlerts(alertValidator{
		aFunc: func(alert *models.Alert) (err error) {
			ok := alert.OrgId != 0 && alert.PanelId != 0
			if !ok {
				err = fmt.Errorf("Org ID or Panel ID is not correct, alertName=%v, panelId=%v, orgId=%v", alert.Name, alert.PanelId, alert.OrgId)
			}
			return err
		},
		aSeverity: alertError,
	})
	return err
}
