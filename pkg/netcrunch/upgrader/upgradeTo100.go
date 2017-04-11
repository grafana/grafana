package upgrader

import (
  "strings"
  "github.com/grafana/grafana/pkg/log"
  "github.com/grafana/grafana/pkg/models"
  "github.com/grafana/grafana/pkg/netcrunch/config"
  "github.com/grafana/grafana/pkg/netcrunch/model"
)

const DS_NETCRUNCH_10_0 = "adremsoft-netcrunch-datasource"

func upgradeTo100(version string) (bool, error) {

  if compare, err := config.CompareVersions(version, "10.0.0"); ((compare < 0) && (err == nil)) {
    uLog := log.New("GrafCrunch upgrader")
    orgs, orgsFound := model.GetOrgs()

    if orgsFound {
      changeNetCrunchDatasourceTypesForOrgs(orgs, uLog)
    }
    uLog.Info("Upgrade successful to 10.0")
    return true, nil
  }

  return false, nil
}

func changeNetCrunchDatasourceTypesForOrgs(orgs []*models.OrgDTO, logger log.Logger) {
  for orgsIndex := range orgs {
    datasources, datasourcesFound := model.GetDatasourcesForOrg(orgs[orgsIndex].Id)
    if datasourcesFound {
      for datasourceIndex := range datasources {
        changeNetCrunchDatasourceType(datasources[datasourceIndex], orgs[orgsIndex], logger)
      }
    }
  }
}

func changeNetCrunchDatasourceType(datasource *models.DataSource, org *models.OrgDTO, logger log.Logger) {
  if (strings.Compare(datasource.Type, DS_NETCRUNCH_94) == 0) {
    datasource.Type = DS_NETCRUNCH_10_0
    model.UpdateDataSource(datasource, org.Id)
    logger.Info("Datasource " + datasource.Name + " for " + org.Name + " has been upgraded")
  }
}