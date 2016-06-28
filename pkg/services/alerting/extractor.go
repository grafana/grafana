package alerting

import (
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

type DashAlertExtractor struct {
	Dash  *m.Dashboard
	OrgId int64
	log   log.Logger
}

func NewDashAlertExtractor(dash *m.Dashboard, orgId int64) *DashAlertExtractor {
	return &DashAlertExtractor{
		Dash:  dash,
		OrgId: orgId,
		log:   log.New("alerting.extractor"),
	}
}

func (e *DashAlertExtractor) lookupDatasourceId(dsName string) (*m.DataSource, error) {
	if dsName == "" {
		query := &m.GetDataSourcesQuery{OrgId: e.OrgId}
		if err := bus.Dispatch(query); err != nil {
			return nil, err
		} else {
			for _, ds := range query.Result {
				if ds.IsDefault {
					return ds, nil
				}
			}
		}
	} else {
		query := &m.GetDataSourceByNameQuery{Name: dsName, OrgId: e.OrgId}
		if err := bus.Dispatch(query); err != nil {
			return nil, err
		} else {
			return query.Result, nil
		}
	}

	return nil, errors.New("Could not find datasource id for " + dsName)
}

func (e *DashAlertExtractor) GetAlerts() ([]*m.Alert, error) {
	e.log.Debug("GetAlerts")

	alerts := make([]*m.Alert, 0)

	for _, rowObj := range e.Dash.Data.Get("rows").MustArray() {
		row := simplejson.NewFromAny(rowObj)

		for _, panelObj := range row.Get("panels").MustArray() {
			panel := simplejson.NewFromAny(panelObj)
			jsonAlert, hasAlert := panel.CheckGet("alert")

			if !hasAlert {
				continue
			}

			enabled, hasEnabled := jsonAlert.CheckGet("enabled")

			if !hasEnabled || !enabled.MustBool() {
				continue
			}

			alert := &m.Alert{
				DashboardId: e.Dash.Id,
				OrgId:       e.OrgId,
				PanelId:     panel.Get("id").MustInt64(),
				Id:          jsonAlert.Get("id").MustInt64(),
				Name:        jsonAlert.Get("name").MustString(),
				Handler:     jsonAlert.Get("handler").MustInt64(),
				Enabled:     jsonAlert.Get("enabled").MustBool(),
				Description: jsonAlert.Get("description").MustString(),
				Frequency:   getTimeDurationStringToSeconds(jsonAlert.Get("frequency").MustString()),
			}

			valueQuery := jsonAlert.Get("query")
			valueQueryRef := valueQuery.Get("refId").MustString()
			for _, targetsObj := range panel.Get("targets").MustArray() {
				target := simplejson.NewFromAny(targetsObj)

				if target.Get("refId").MustString() == valueQueryRef {
					dsName := ""
					if target.Get("datasource").MustString() != "" {
						dsName = target.Get("datasource").MustString()
					} else if panel.Get("datasource").MustString() != "" {
						dsName = panel.Get("datasource").MustString()
					}

					if datasource, err := e.lookupDatasourceId(dsName); err != nil {
						return nil, err
					} else {
						valueQuery.SetPath([]string{"datasourceId"}, datasource.Id)
						valueQuery.SetPath([]string{"datasourceType"}, datasource.Type)
					}

					targetQuery := target.Get("target").MustString()
					if targetQuery != "" {
						jsonAlert.SetPath([]string{"query", "query"}, targetQuery)
					}
				}
			}

			alert.Settings = jsonAlert

			// validate
			_, err := NewAlertRuleFromDBModel(alert)
			if err == nil && alert.ValidToSave() {
				alerts = append(alerts, alert)
			} else {
				e.log.Error("Failed to extract alerts from dashboard", "error", err)
				return nil, errors.New("Failed to extract alerts from dashboard")
			}

		}
	}

	e.log.Debug("Extracted alerts from dashboard", "alertCount", len(alerts))
	return alerts, nil
}
