package datasources

import "github.com/grafana/grafana/pkg/models"
import "github.com/grafana/grafana/pkg/components/simplejson"

type DatasourcesAsConfig struct {
	PurgeOtherDatasources bool                   `json:"purge_other_datasources" yaml:"purge_other_datasources"`
	Datasources           []DataSourceFromConfig `json:"datasources" yaml:"datasources"`
}

type DataSourceFromConfig struct {
	OrgId   int64 `json:"org_id" yaml:"org_id"`
	Version int   `json:"version" yaml:"version"`

	Name              string            `json:"name" yaml:"name"`
	Type              string            `json:"type" yaml:"type"`
	Access            string            `json:"access" yaml:"access"`
	Url               string            `json:"url" yaml:"url"`
	Password          string            `json:"password" yaml:"password"`
	User              string            `json:"user" yaml:"user"`
	Database          string            `json:"database" yaml:"database"`
	BasicAuth         bool              `json:"basic_auth" yaml:"basic_auth"`
	BasicAuthUser     string            `json:"basic_auth_user" yaml:"basic_auth_user"`
	BasicAuthPassword string            `json:"basic_auth_password" yaml:"basic_auth_password"`
	WithCredentials   bool              `json:"with_credentials" yaml:"with_credentials"`
	IsDefault         bool              `json:"is_default" yaml:"is_default"`
	JsonData          string            `json:"json_data" yaml:"json_data"`
	SecureJsonData    map[string]string `json:"secure_json_data" yaml:"secure_json_data"`
}

func createInsertCommand(ds DataSourceFromConfig) *models.AddDataSourceCommand {
	jsonData, err := simplejson.NewJson([]byte(ds.JsonData))
	if err != nil {
		jsonData = simplejson.New()
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
		ReadOnly:          true,
	}
}

func createUpdateCommand(ds DataSourceFromConfig, id int64) *models.UpdateDataSourceCommand {
	jsonData, err := simplejson.NewJson([]byte(ds.JsonData))
	if err != nil {
		jsonData = simplejson.New()
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
		ReadOnly:          true,
	}
}
