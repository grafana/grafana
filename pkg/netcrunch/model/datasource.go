package model

import (
  "github.com/grafana/grafana/pkg/bus"
  "github.com/grafana/grafana/pkg/models"
)

type DatasourceProcessor func(datasource *models.DataSource, org *models.OrgDTO)

func GetDataSourceByName(datasourceName string, orgId int64) (*models.DataSource, bool) {
  query := models.GetDataSourceByNameQuery {
    Name: datasourceName,
    OrgId: orgId,
  }

  err := bus.Dispatch(&query)
  return query.Result, (err == nil)
}

func AddDataSource(datasource models.DataSource, orgId int64) bool {
  command := models.AddDataSourceCommand {
    OrgId:             orgId,
    Name:              datasource.Name,
    Type:              datasource.Type,
    Access:            datasource.Access,
    Url:               datasource.Url,
    User:              datasource.User,
    Password:          datasource.Password,
    Database:          datasource.Database,
    BasicAuth:         datasource.BasicAuth,
    BasicAuthUser:     datasource.BasicAuthUser,
    BasicAuthPassword: datasource.BasicAuthPassword,
    WithCredentials:   datasource.WithCredentials,
    IsDefault:         datasource.IsDefault,
    JsonData:          datasource.JsonData,
  }
  return (bus.Dispatch(&command) == nil)
}

func UpdateDataSource(datasource *models.DataSource, orgId int64) bool {
  command := models.UpdateDataSourceCommand {
    Id:                datasource.Id,
    OrgId:             orgId,
    Name:              datasource.Name,
    Type:              datasource.Type,
    Access:            datasource.Access,
    Url:               datasource.Url,
    User:              datasource.User,
    Password:          datasource.Password,
    Database:          datasource.Database,
    BasicAuth:         datasource.BasicAuth,
    BasicAuthUser:     datasource.BasicAuthUser,
    BasicAuthPassword: datasource.BasicAuthPassword,
    WithCredentials:   datasource.WithCredentials,
    IsDefault:         datasource.IsDefault,
    JsonData:          datasource.JsonData,
  }
  return (bus.Dispatch(&command) == nil)
}

func GetDatasourcesForOrg(orgId int64) ([]*models.DataSource, bool) {
  query := models.GetDataSourcesQuery {
    OrgId: orgId,
  }

  err := bus.Dispatch(&query)
  return query.Result, (err == nil)
}

func ProcessDatasourcesForOrg(org *models.OrgDTO, datasourceProcessor DatasourceProcessor) {
  datasources, datasourcesFound := GetDatasourcesForOrg(org.Id)
  if datasourcesFound {
    for datasourceIndex := range datasources {
      datasource := datasources[datasourceIndex]
      datasourceProcessor(datasource, org)
    }
  }
}
