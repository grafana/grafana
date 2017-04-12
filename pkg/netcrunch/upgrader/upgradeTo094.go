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

func upgradeTo094(version string, logger log.Logger) (bool) {

  if compare, err := config.CompareVersions(version, "9.4.0"); ((compare < 0) && (err == nil)) {
    model.ProcessOrgs(func (org *models.OrgDTO) {
      model.ProcessDatasourcesForOrg(org, func(datasource *models.DataSource, org *models.OrgDTO) {
        if (strings.Compare(datasource.Type, DS_NETCRUNCH_90) == 0) {
          model.UpdateDataSource(convertNetCrunchDatasource(datasource), org.Id)
          logger.Info("Datasource " + datasource.Name + " for " + org.Name + " has been upgraded")
        }
      })
    })
    logger.Info("Upgrade successful to 9.4")
    return true
  }

  return false
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
