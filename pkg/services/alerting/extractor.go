package alerting

import (
	"errors"

	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

// DashAlertExtractor extracts alerts from the dashboard json
type DashAlertExtractor struct {
	Dash  *m.Dashboard
	OrgID int64
	log   log.Logger
}

type MultipartQueryCondition struct {
	Index         int
	QueryParts    []QueryPart
	Operator      string
	HandleRequest tsdb.HandleRequestFunc
}

type NamedAlertQuery struct {
	Model        *simplejson.Json
	DatasourceId int64
	ReferenceId  string
	From         string
	To           string
}

type QueryPart struct {
	Query  NamedAlertQuery
	Scalar null.Float
}

// NewDashAlertExtractor returns a new DashAlertExtractor
func NewDashAlertExtractor(dash *m.Dashboard, orgID int64) *DashAlertExtractor {
	return &DashAlertExtractor{
		Dash:  dash,
		OrgID: orgID,
		log:   log.New("alerting.extractor"),
	}
}

func (e *DashAlertExtractor) lookupDatasourceId(dsName string) (*m.DataSource, error) {
	if dsName == "" {
		query := &m.GetDataSourcesQuery{OrgId: e.OrgID}
		if err := bus.Dispatch(query); err != nil {
			return nil, err
		}

		for _, ds := range query.Result {
			if ds.IsDefault {
				return ds, nil
			}
		}
	} else {
		query := &m.GetDataSourceByNameQuery{Name: dsName, OrgId: e.OrgID}
		if err := bus.Dispatch(query); err != nil {
			return nil, err
		}

		return query.Result, nil
	}

	return nil, errors.New("Could not find datasource id for " + dsName)
}

func findPanelQueryByRefId(panel *simplejson.Json, refID string) *simplejson.Json {
	for _, targetsObj := range panel.Get("targets").MustArray() {
		target := simplejson.NewFromAny(targetsObj)

		if target.Get("refId").MustString() == refID {
			return target
		}
	}
	return nil
}

func copyJSON(in *simplejson.Json) (*simplejson.Json, error) {
	rawJSON, err := in.MarshalJSON()
	if err != nil {
		return nil, err
	}

	return simplejson.NewJson(rawJSON)
}

func (e *DashAlertExtractor) getAlertFromPanels(jsonWithPanels *simplejson.Json, validateAlertFunc func(*m.Alert) bool) ([]*m.Alert, error) {
	alerts := make([]*m.Alert, 0)

	for _, panelObj := range jsonWithPanels.Get("panels").MustArray() {
		panel := simplejson.NewFromAny(panelObj)

		collapsedJSON, collapsed := panel.CheckGet("collapsed")
		// check if the panel is collapsed
		if collapsed && collapsedJSON.MustBool() {

			// extract alerts from sub panels for collapsed panels
			als, err := e.getAlertFromPanels(panel, validateAlertFunc)
			if err != nil {
				return nil, err
			}

			alerts = append(alerts, als...)
			continue
		}

		jsonAlert, hasAlert := panel.CheckGet("alert")

		if !hasAlert {
			continue
		}

		panelID, err := panel.Get("id").Int64()
		if err != nil {
			return nil, fmt.Errorf("panel id is required. err %v", err)
		}
		// backward compatibility check, can be removed later
		enabled, hasEnabled := jsonAlert.CheckGet("enabled")
		if hasEnabled && !enabled.MustBool() {
			continue
		}

		frequency, err := getTimeDurationStringToSeconds(jsonAlert.Get("frequency").MustString())
		if err != nil {
			return nil, ValidationError{Reason: "Could not parse frequency"}
		}
		alert := &m.Alert{
			DashboardId: e.Dash.Id,
			OrgId:       e.OrgID,
			PanelId:     panelID,
			Id:          jsonAlert.Get("id").MustInt64(),
			Name:        jsonAlert.Get("name").MustString(),
			Handler:     jsonAlert.Get("handler").MustInt64(),
			Message:     jsonAlert.Get("message").MustString(),
			Frequency:   frequency,
		}

		for _, condition := range jsonAlert.Get("conditions").MustArray() {
			jsonCondition := simplejson.NewFromAny(condition)
			if jsonCondition.Get("type").MustString() == "multipartQuery" {
				check, err := CheckMultipartQuery(jsonCondition, panel, e)
				if err != nil {
					return check, err
				}
			} else if jsonCondition.Get("type").MustString() == "query" {
				check, err := CheckSingleQuery(jsonCondition, panel, e)
				if err != nil {
					return check, err
				}
			} else {
				reason := fmt.Sprintf("Invalid model type")
				return nil, ValidationError{Reason: reason}
			}
		}
		alert.Settings = jsonAlert

		// validate
		_, err = NewRuleFromDBAlert(alert)
		if err != nil {
			return nil, err
		}

		if !validateAlertFunc(alert) {
			e.log.Debug("Invalid Alert Data. Dashboard, Org, or Panel ID is not correct", "alertName", alert.Name, "panelId", alert.PanelId)
			return nil, m.ErrDashboardContainsInvalidAlertData
		}

		alerts = append(alerts, alert)
	}

	return alerts, nil
}

func CheckMultipartQuery(jsonCondition *simplejson.Json, panel *simplejson.Json, e *DashAlertExtractor) ([]*m.Alert, error) {
	tempCondition := MultipartQueryCondition{}
	tempCondition.QueryParts = make([]QueryPart, 2)
	for i := range tempCondition.QueryParts {
		tempCondition.QueryParts[i] = QueryPart{}
		queryPartModel := jsonCondition.Get("queryParts").GetIndex(i)
		jsonQuery := queryPartModel.Get("query")
		queryRefId := jsonQuery.Get("params").MustArray()[0].(string)
		panelQuery := findPanelQueryByRefId(panel, queryRefId)
		if panelQuery == nil {
			reason := fmt.Sprintf("Alert on PanelId:  refers to query(%s) that cannot be found", queryRefId)
			return nil, ValidationError{Reason: reason}
		}

		dsName := ""
		if panelQuery.Get("datasource").MustString() != "" {
			dsName = panelQuery.Get("datasource").MustString()
		} else if panel.Get("datasource").MustString() != "" {
			dsName = panel.Get("datasource").MustString()
		}

		if datasource, err := e.lookupDatasourceId(dsName); err != nil {
			return nil, err
		} else {
			jsonQuery.SetPath([]string{"datasourceId"}, datasource.Id)
		}

		if interval, err := panel.Get("interval").String(); err == nil {
			panelQuery.Set("interval", interval)
		}

		jsonQuery.Set("model", panelQuery.Interface())
	}
	return nil, nil
}

func CheckSingleQuery(jsonCondition *simplejson.Json, panel *simplejson.Json, e *DashAlertExtractor) ([]*m.Alert, error) {
	jsonQuery := jsonCondition.Get("query")
	queryRefId := jsonQuery.Get("params").MustArray()[0].(string)
	panelQuery := findPanelQueryByRefId(panel, queryRefId)
	if panelQuery == nil {
		reason := fmt.Sprintf("Alert on PanelId: refers to query(%s) that cannot be found", queryRefId)
		return nil, ValidationError{Reason: reason}
	}

	dsName := ""
	if panelQuery.Get("datasource").MustString() != "" {
		dsName = panelQuery.Get("datasource").MustString()
	} else if panel.Get("datasource").MustString() != "" {
		dsName = panel.Get("datasource").MustString()
	}

	if datasource, err := e.lookupDatasourceId(dsName); err != nil {
		return nil, err
	} else {
		jsonQuery.SetPath([]string{"datasourceId"}, datasource.Id)
	}

	if interval, err := panel.Get("interval").String(); err == nil {
		panelQuery.Set("interval", interval)
	}

	jsonQuery.Set("model", panelQuery.Interface())
	return nil, nil
}

func (e *DashAlertExtractor) GetInterval(jsonCondition *simplejson.Json, index int) string {
	tempCondition := MultipartQueryCondition{}
	tempCondition.HandleRequest = tsdb.HandleRequest
	queryCount := 2
	tempCondition.QueryParts = make([]QueryPart, queryCount)
	tempCondition.QueryParts[index] = QueryPart{}
	queryPartModel := jsonCondition.Get("queryParts").GetIndex(index)
	return queryPartModel.Get("query").Get("model").Get("interval").MustString()
}

func validateAlertRule(alert *m.Alert) bool {
	return alert.ValidToSave()
}

// GetAlerts extracts alerts from the dashboard json and does full validation on the alert json data
func (e *DashAlertExtractor) GetAlerts() ([]*m.Alert, error) {
	return e.extractAlerts(validateAlertRule)
}

func (e *DashAlertExtractor) extractAlerts(validateFunc func(alert *m.Alert) bool) ([]*m.Alert, error) {
	dashboardJSON, err := copyJSON(e.Dash.Data)
	if err != nil {
		return nil, err
	}

	alerts := make([]*m.Alert, 0)

	// We extract alerts from rows to be backwards compatible
	// with the old dashboard json model.
	rows := dashboardJSON.Get("rows").MustArray()
	if len(rows) > 0 {
		for _, rowObj := range rows {
			row := simplejson.NewFromAny(rowObj)
			a, err := e.getAlertFromPanels(row, validateFunc)
			if err != nil {
				return nil, err
			}

			alerts = append(alerts, a...)
		}
	} else {
		a, err := e.getAlertFromPanels(dashboardJSON, validateFunc)
		if err != nil {
			return nil, err
		}

		alerts = append(alerts, a...)
	}

	e.log.Debug("Extracted alerts from dashboard", "alertCount", len(alerts))
	return alerts, nil
}

// ValidateAlerts validates alerts in the dashboard json but does not require a valid dashboard id
// in the first validation pass
func (e *DashAlertExtractor) ValidateAlerts() error {
	_, err := e.extractAlerts(func(alert *m.Alert) bool { return alert.OrgId != 0 && alert.PanelId != 0 })
	return err
}
