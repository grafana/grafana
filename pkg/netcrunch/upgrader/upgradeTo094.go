package upgrader

import (
  "strings"
  "github.com/grafana/grafana/pkg/log"
  "github.com/grafana/grafana/pkg/models"
  "github.com/grafana/grafana/pkg/components/simplejson"
  "github.com/grafana/grafana/pkg/netcrunch/config"
  "github.com/grafana/grafana/pkg/netcrunch/model"
)

const DS_NETCRUNCH_94 = "grafana-netcrunch-datasource"

func upgradeTo094(version string) (bool, error) {

  if compare, err := config.CompareVersions(version, "9.4.0"); ((compare < 0) && (err == nil)) {
    uLog := log.New("GrafCrunch upgrader")
    orgs, orgsFound := model.GetOrgs()

    if orgsFound {
      upgradeNetCrunchDatasourcesForOrgs(orgs, uLog)
    }
    uLog.Info("Upgrade successful to 9.4")
  }

  return false, nil
}

func upgradeNetCrunchDatasourcesForOrgs(orgs []*models.OrgDTO, logger log.Logger) {
  for orgsIndex := range orgs {
    datasources, datasourcesFound := model.GetDatasourcesForOrg(orgs[orgsIndex].Id)
    if datasourcesFound {
      for datasourceIndex := range datasources {
        upgradeNetCrunchDatasource(datasources[datasourceIndex], orgs[orgsIndex], logger)
      }
    }
  }
}

func upgradeNetCrunchDatasource(datasource *models.DataSource, org *models.OrgDTO, logger log.Logger) {
  if (strings.Compare(datasource.Type, DS_NETCRUNCH_90) == 0) {
    model.UpdateDataSource(convertNetCrunchDatasource(datasource), org.Id)
    logger.Info("Datasource " + datasource.Name + " for " + org.Name + " has been upgraded")
  }
}

func convertNetCrunchDatasource(datasource *models.DataSource) *models.DataSource {
  urlParts := strings.Split(datasource.Url, "://")
  protocol := urlParts[0]
  simpleUrl := urlParts[1]

  jsonDataBuffer := simplejson.New()
  jsonDataBuffer.Set("simpleUrl", simpleUrl)
  jsonDataBuffer.Set("isSSL", (strings.Compare(strings.ToUpper(protocol), "HTTPS") == 0))
  jsonDataBuffer.Set("user", datasource.User)
  jsonDataBuffer.Set("password", datasource.Password)

  datasource.Type = DS_NETCRUNCH_94
  datasource.JsonData = jsonDataBuffer

  return datasource
}
