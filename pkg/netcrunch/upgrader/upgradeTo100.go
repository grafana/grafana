package upgrader

import (
  "strings"
  "github.com/grafana/grafana/pkg/log"
  "github.com/grafana/grafana/pkg/models"
  "github.com/grafana/grafana/pkg/netcrunch/config"
  "github.com/grafana/grafana/pkg/netcrunch/model"
)

const DS_NETCRUNCH_10_0 = "adremsoft-netcrunch-datasource"

func upgradeTo100(version string, logger log.Logger) (bool) {

  if compare, err := config.CompareVersions(version, "10.0.0"); ((compare < 0) && (err == nil)) {
    model.ProcessOrgs(func (org *models.OrgDTO) {
      model.ProcessDatasourcesForOrg(org, func(datasource *models.DataSource, org *models.OrgDTO) {
        changeNetCrunchDatasourceType(datasource, org, logger)
      })
    })
    logger.Info("Upgrade successful to 10.0")
    return true
  }

  return false
}

func changeNetCrunchDatasourceType(datasource *models.DataSource, org *models.OrgDTO, logger log.Logger) {
  if (strings.Compare(datasource.Type, DS_NETCRUNCH_94) == 0) {
    datasource.Type = DS_NETCRUNCH_10_0
    model.UpdateDataSource(datasource, org.Id)
    logger.Info("Datasource " + datasource.Name + " for " + org.Name + " has been upgraded")
  }
}
