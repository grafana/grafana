package upgrader

import (
  "strings"
  "github.com/grafana/grafana/pkg/log"
  "github.com/grafana/grafana/pkg/models"
  "github.com/grafana/grafana/pkg/netcrunch/config"
  "github.com/grafana/grafana/pkg/netcrunch/model"
  "github.com/grafana/grafana/pkg/components/simplejson"
)

const DS_NETCRUNCH_10_0 = "adremsoft-netcrunch-datasource"

func upgradeTo100(version string, logger log.Logger) (bool) {

  if compare, err := config.CompareVersions(version, "10.0.0"); ((compare < 0) && (err == nil)) {
    upgradeDatasourcesTo100(logger)
    upgradeDashboards(logger)
    logger.Info("Upgrade successful to 10.0")
    return true
  }

  return false
}

func upgradeDatasourcesTo100(logger log.Logger) {
  model.ProcessOrgs(func (org *models.OrgDTO) {
    model.ProcessDatasourcesForOrg(org, func(datasource *models.DataSource, org *models.OrgDTO) {
      changeNetCrunchDatasourceType(datasource, org, logger)
    })
  })
}

func changeNetCrunchDatasourceType(datasource *models.DataSource, org *models.OrgDTO, logger log.Logger) {
  if (strings.Compare(datasource.Type, DS_NETCRUNCH_94) == 0) {
    datasource.Type = DS_NETCRUNCH_10_0
    model.UpdateDataSource(datasource, org.Id)
    logger.Info("Datasource " + datasource.Name + " for " + org.Name + " has been upgraded")
  }
}


func upgradeDashboards(logger log.Logger) {
  model.ProcessDashboards(func(dashboard *models.Dashboard) {
    upgradedVariableList, upgraded := upgradeTemplateVariables(getTemplateVariables(dashboard))
    if (upgraded) {
      setTemplateVariables(dashboard, upgradedVariableList)
      model.UpdateDashboard(dashboard)
      logger.Info("Dashboard: " + dashboard.Title + " has been upgraded")
    }
  })
}

func getTemplateVariables(dashboard *models.Dashboard) ([]interface{}) {
  return dashboard.Data.Get("templating").Get("list").MustArray()
}

func upgradeTemplateVariables(variableList []interface{}) ([]interface{}, bool) {
  upgraded := false

  for variableIndex, variableObj := range variableList {
    variable := simplejson.NewFromAny(variableObj)
    if ((variable.Get("type").MustString("") == "datasource") &&
        (variable.Get("query").MustString("") == DS_NETCRUNCH_94)) {
      variable.Set("query", DS_NETCRUNCH_10_0)
      variableList[variableIndex] = variable
      upgraded = true
    }
  }

  return variableList, upgraded
}

func setTemplateVariables(dashboard *models.Dashboard, variableList []interface{}) {
  dashboard.Data.Get("templating").Set("list", variableList)
}
