package alerting

import (
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

type AlertRuleExtractor struct {
	Dash  *m.Dashboard
	OrgId int64
	log   log.Logger
}

func NewAlertRuleExtractor(dash *m.Dashboard, orgId int64) *AlertRuleExtractor {
	return &AlertRuleExtractor{
		Dash:  dash,
		OrgId: orgId,
		log:   log.New("alerting.extractor"),
	}
}

func (e *AlertRuleExtractor) lookupDatasourceId(dsName string) (int64, error) {
	if dsName == "" {
		query := &m.GetDataSourcesQuery{OrgId: e.OrgId}
		if err := bus.Dispatch(query); err != nil {
			return 0, err
		} else {
			for _, ds := range query.Result {
				if ds.IsDefault {
					return ds.Id, nil
				}
			}
		}
	} else {
		query := &m.GetDataSourceByNameQuery{Name: dsName, OrgId: e.OrgId}
		if err := bus.Dispatch(query); err != nil {
			return 0, err
		} else {
			return query.Result.Id, nil
		}
	}

	return 0, errors.New("Could not find datasource id for " + dsName)
}

func (e *AlertRuleExtractor) GetRuleModels() (m.AlertRules, error) {

	rules := make(m.AlertRules, 0)

	for _, rowObj := range e.Dash.Data.Get("rows").MustArray() {
		row := simplejson.NewFromAny(rowObj)

		for _, panelObj := range row.Get("panels").MustArray() {
			panel := simplejson.NewFromAny(panelObj)
			jsonRule := panel.Get("alerting")

			// check if marked for deletion
			deleted := jsonRule.Get("deleted").MustBool()
			if deleted {
				e.log.Info("Deleted alert rule found")
				continue
			}

			ruleModel := &m.Alert{
				DashboardId: e.Dash.Id,
				OrgId:       e.OrgId,
				PanelId:     panel.Get("id").MustInt64(),
				Id:          jsonRule.Get("id").MustInt64(),
				Name:        jsonRule.Get("name").MustString(),
				Scheduler:   jsonRule.Get("scheduler").MustInt64(),
				Enabled:     jsonRule.Get("enabled").MustBool(),
				Description: jsonRule.Get("description").MustString(),
			}

			valueQuery := jsonRule.Get("query")
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

					if datasourceId, err := e.lookupDatasourceId(dsName); err != nil {
						return nil, err
					} else {
						valueQuery.SetPath([]string{"datasourceId"}, datasourceId)
					}

					targetQuery := target.Get("target").MustString()
					if targetQuery != "" {
						jsonRule.SetPath([]string{"query", "query"}, targetQuery)
					}
				}
			}

			ruleModel.Expression = jsonRule

			// validate
			_, err := NewAlertRuleFromDBModel(ruleModel)
			if err == nil && ruleModel.ValidToSave() {
				rules = append(rules, ruleModel)
			} else {
				e.log.Error("Failed to extract alert rules from dashboard", "error", err)
				return nil, errors.New("Failed to extract alert rules from dashboard")
			}

		}
	}

	return rules, nil
}
