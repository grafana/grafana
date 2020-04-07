package datasources

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

type ConfigVersion struct {
	ApiVersion int64 `json:"apiVersion" yaml:"apiVersion"`
}

type DatasourcesAsConfig struct {
	ApiVersion int64

	Datasources       []*DataSourceFromConfig
	DeleteDatasources []*DeleteDatasourceConfig
}

type DeleteDatasourceConfig struct {
	OrgId int64
	Name  string
}

type DataSourceFromConfig struct {
	OrgId   int64
	Version int

	Name              string
	Type              string
	Access            string
	Url               string
	Password          string
	User              string
	Database          string
	BasicAuth         bool
	BasicAuthUser     string
	BasicAuthPassword string
	WithCredentials   bool
	IsDefault         bool
	JsonData          map[string]interface{}
	SecureJsonData    map[string]string
	Editable          bool
}

type DatasourcesAsConfigV0 struct {
	ConfigVersion

	Datasources       []*DataSourceFromConfigV0   `json:"datasources" yaml:"datasources"`
	DeleteDatasources []*DeleteDatasourceConfigV0 `json:"delete_datasources" yaml:"delete_datasources"`
}

type DatasourcesAsConfigV1 struct {
	ConfigVersion
	log log.Logger

	Datasources       []*DataSourceFromConfigV1   `json:"datasources" yaml:"datasources"`
	DeleteDatasources []*DeleteDatasourceConfigV1 `json:"deleteDatasources" yaml:"deleteDatasources"`
}

type DeleteDatasourceConfigV0 struct {
	OrgId int64  `json:"org_id" yaml:"org_id"`
	Name  string `json:"name" yaml:"name"`
}

type DeleteDatasourceConfigV1 struct {
	OrgId values.Int64Value  `json:"orgId" yaml:"orgId"`
	Name  values.StringValue `json:"name" yaml:"name"`
}

type DataSourceFromConfigV0 struct {
	OrgId             int64                  `json:"org_id" yaml:"org_id"`
	Version           int                    `json:"version" yaml:"version"`
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

type DataSourceFromConfigV1 struct {
	OrgId             values.Int64Value     `json:"orgId" yaml:"orgId"`
	Version           values.IntValue       `json:"version" yaml:"version"`
	Name              values.StringValue    `json:"name" yaml:"name"`
	Type              values.StringValue    `json:"type" yaml:"type"`
	Access            values.StringValue    `json:"access" yaml:"access"`
	Url               values.StringValue    `json:"url" yaml:"url"`
	Password          values.StringValue    `json:"password" yaml:"password"`
	User              values.StringValue    `json:"user" yaml:"user"`
	Database          values.StringValue    `json:"database" yaml:"database"`
	BasicAuth         values.BoolValue      `json:"basicAuth" yaml:"basicAuth"`
	BasicAuthUser     values.StringValue    `json:"basicAuthUser" yaml:"basicAuthUser"`
	BasicAuthPassword values.StringValue    `json:"basicAuthPassword" yaml:"basicAuthPassword"`
	WithCredentials   values.BoolValue      `json:"withCredentials" yaml:"withCredentials"`
	IsDefault         values.BoolValue      `json:"isDefault" yaml:"isDefault"`
	JsonData          values.JSONValue      `json:"jsonData" yaml:"jsonData"`
	SecureJsonData    values.StringMapValue `json:"secureJsonData" yaml:"secureJsonData"`
	Editable          values.BoolValue      `json:"editable" yaml:"editable"`
}

func (cfg *DatasourcesAsConfigV1) mapToDatasourceFromConfig(apiVersion int64) *DatasourcesAsConfig {
	r := &DatasourcesAsConfig{}

	r.ApiVersion = apiVersion

	if cfg == nil {
		return r
	}

	for _, ds := range cfg.Datasources {
		r.Datasources = append(r.Datasources, &DataSourceFromConfig{
			OrgId:             ds.OrgId.Value(),
			Name:              ds.Name.Value(),
			Type:              ds.Type.Value(),
			Access:            ds.Access.Value(),
			Url:               ds.Url.Value(),
			Password:          ds.Password.Value(),
			User:              ds.User.Value(),
			Database:          ds.Database.Value(),
			BasicAuth:         ds.BasicAuth.Value(),
			BasicAuthUser:     ds.BasicAuthUser.Value(),
			BasicAuthPassword: ds.BasicAuthPassword.Value(),
			WithCredentials:   ds.WithCredentials.Value(),
			IsDefault:         ds.IsDefault.Value(),
			JsonData:          ds.JsonData.Value(),
			SecureJsonData:    ds.SecureJsonData.Value(),
			Editable:          ds.Editable.Value(),
			Version:           ds.Version.Value(),
		})

		// Using Raw value for the warnings here so that even if it uses env interpolation and the env var is empty
		// it will still warn
		if len(ds.Password.Raw) > 0 {
			cfg.log.Warn(
				"[Deprecated] the use of password field is deprecated. Please use secureJsonData.password",
				"datasource name",
				ds.Name.Value(),
			)
		}
		if len(ds.BasicAuthPassword.Raw) > 0 {
			cfg.log.Warn(
				"[Deprecated] the use of basicAuthPassword field is deprecated. Please use secureJsonData.basicAuthPassword",
				"datasource name",
				ds.Name.Value(),
			)
		}
	}

	for _, ds := range cfg.DeleteDatasources {
		r.DeleteDatasources = append(r.DeleteDatasources, &DeleteDatasourceConfig{
			OrgId: ds.OrgId.Value(),
			Name:  ds.Name.Value(),
		})
	}

	return r
}

func (cfg *DatasourcesAsConfigV0) mapToDatasourceFromConfig(apiVersion int64) *DatasourcesAsConfig {
	r := &DatasourcesAsConfig{}

	r.ApiVersion = apiVersion

	if cfg == nil {
		return r
	}

	for _, ds := range cfg.Datasources {
		r.Datasources = append(r.Datasources, &DataSourceFromConfig{
			OrgId:             ds.OrgId,
			Name:              ds.Name,
			Type:              ds.Type,
			Access:            ds.Access,
			Url:               ds.Url,
			Password:          ds.Password,
			User:              ds.User,
			Database:          ds.Database,
			BasicAuth:         ds.BasicAuth,
			BasicAuthUser:     ds.BasicAuthUser,
			BasicAuthPassword: ds.BasicAuthPassword,
			WithCredentials:   ds.WithCredentials,
			IsDefault:         ds.IsDefault,
			JsonData:          ds.JsonData,
			SecureJsonData:    ds.SecureJsonData,
			Editable:          ds.Editable,
			Version:           ds.Version,
		})
	}

	for _, ds := range cfg.DeleteDatasources {
		r.DeleteDatasources = append(r.DeleteDatasources, &DeleteDatasourceConfig{
			OrgId: ds.OrgId,
			Name:  ds.Name,
		})
	}

	return r
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
