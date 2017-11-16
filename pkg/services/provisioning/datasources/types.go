package datasources

import "github.com/grafana/grafana/pkg/models"
import "github.com/grafana/grafana/pkg/components/simplejson"

type DatasourcesAsConfig struct {
	Datasources       []*DataSourceFromConfig   `json:"datasources" yaml:"datasources"`
	DeleteDatasources []*DeleteDatasourceConfig `json:"delete_datasources" yaml:"delete_datasources"`
}

type DeleteDatasourceConfig struct {
	OrgId int64  `json:"org_id" yaml:"org_id"`
	Name  string `json:"name" yaml:"name"`
}

type DataSourceFromConfig struct {
	OrgId   int64 `json:"org_id" yaml:"org_id"`
	Version int   `json:"version" yaml:"version"`

	Name              string                 `json:"name" yaml:"name"`
	Type              string                 `json:"type" yaml:"type"`
	Access            string                 `json:"access" yaml:"access"`
	Url               string                 `json:"url" yaml:"url"`
	Password          string                 `json:"password" yaml:"password"`
	User              string                 `json:"user" yaml:"user"`
	Database          string                 `json:"database" yaml:"database"`
	BasicAuth         bool                   `json:"basic_auth" yaml:"basic_auth"`
	BasicAuthUser     string                 `json:"basic_auth_user" yaml:"basic_auth_user"`
	BasicAuthPassword string                 `json:"basic_auth_password" yaml:"basic_auth_password"`
	WithCredentials   bool                   `json:"with_credentials" yaml:"with_credentials"`
	IsDefault         bool                   `json:"is_default" yaml:"is_default"`
	JsonData          map[string]interface{} `json:"json_data" yaml:"json_data"`
	SecureJsonData    map[string]string      `json:"secure_json_data" yaml:"secure_json_data"`
	Editable          bool                   `json:"editable" yaml:"editable"`
}

func createInsertCommand(ds *DataSourceFromConfig) *models.AddDataSourceCommand {
	jsonData := simplejson.New()
	if len(ds.JsonData) > 0 {
		for k, v := range ds.JsonData {
			jsonData.Set(k, v)
		}
	}

	return &models.AddDataSourceCommand{
		OrgId:             ds.OrgId,
		Name:              ds.Name,
		Type:              ds.Type,
		Access:            models.DsAccess(ds.Access),
		Url:               ds.Url,
		Password:          ds.Password,
		User:              ds.User,
		Database:          ds.Database,
		BasicAuth:         ds.BasicAuth,
		BasicAuthUser:     ds.BasicAuthUser,
		BasicAuthPassword: ds.BasicAuthPassword,
		WithCredentials:   ds.WithCredentials,
		IsDefault:         ds.IsDefault,
		JsonData:          jsonData,
		SecureJsonData:    ds.SecureJsonData,
		ReadOnly:          !ds.Editable,
	}
}

func createUpdateCommand(ds *DataSourceFromConfig, id int64) *models.UpdateDataSourceCommand {
	jsonData := simplejson.New()
	if len(ds.JsonData) > 0 {
		for k, v := range ds.JsonData {
			jsonData.Set(k, v)
		}
	}

	return &models.UpdateDataSourceCommand{
		Id:                id,
		OrgId:             ds.OrgId,
		Name:              ds.Name,
		Type:              ds.Type,
		Access:            models.DsAccess(ds.Access),
		Url:               ds.Url,
		Password:          ds.Password,
		User:              ds.User,
		Database:          ds.Database,
		BasicAuth:         ds.BasicAuth,
		BasicAuthUser:     ds.BasicAuthUser,
		BasicAuthPassword: ds.BasicAuthPassword,
		WithCredentials:   ds.WithCredentials,
		IsDefault:         ds.IsDefault,
		JsonData:          jsonData,
		SecureJsonData:    ds.SecureJsonData,
		ReadOnly:          !ds.Editable,
	}
}
