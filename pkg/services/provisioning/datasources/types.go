package datasources

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/provisioning/values"
)

// ConfigVersion is used to figure out which API version a config uses.
type configVersion struct {
	APIVersion int64 `json:"apiVersion" yaml:"apiVersion"`
}

type configs struct {
	APIVersion int64

	Datasources       []*upsertDataSourceFromConfig
	DeleteDatasources []*deleteDatasourceConfig
}

type deleteDatasourceConfig struct {
	OrgID int64
	Name  string
}

type upsertDataSourceFromConfig struct {
	OrgID   int64
	Version int

	Name              string
	Type              string
	Access            string
	URL               string
	Password          string
	User              string
	Database          string
	BasicAuth         bool
	BasicAuthUser     string
	BasicAuthPassword string
	WithCredentials   bool
	IsDefault         bool
	JSONData          map[string]interface{}
	SecureJSONData    map[string]string
	Editable          bool
	UID               string
}

type configsV0 struct {
	configVersion

	Datasources       []*upsertDataSourceFromConfigV0 `json:"datasources" yaml:"datasources"`
	DeleteDatasources []*deleteDatasourceConfigV0     `json:"delete_datasources" yaml:"delete_datasources"`
}

type configsV1 struct {
	configVersion
	log log.Logger

	Datasources       []*upsertDataSourceFromConfigV1 `json:"datasources" yaml:"datasources"`
	DeleteDatasources []*deleteDatasourceConfigV1     `json:"deleteDatasources" yaml:"deleteDatasources"`
}

type deleteDatasourceConfigV0 struct {
	OrgID int64  `json:"org_id" yaml:"org_id"`
	Name  string `json:"name" yaml:"name"`
}

type deleteDatasourceConfigV1 struct {
	OrgID values.Int64Value  `json:"orgId" yaml:"orgId"`
	Name  values.StringValue `json:"name" yaml:"name"`
}

type upsertDataSourceFromConfigV0 struct {
	OrgID             int64                  `json:"org_id" yaml:"org_id"`
	Version           int                    `json:"version" yaml:"version"`
	Name              string                 `json:"name" yaml:"name"`
	Type              string                 `json:"type" yaml:"type"`
	Access            string                 `json:"access" yaml:"access"`
	URL               string                 `json:"url" yaml:"url"`
	Password          string                 `json:"password" yaml:"password"`
	User              string                 `json:"user" yaml:"user"`
	Database          string                 `json:"database" yaml:"database"`
	BasicAuth         bool                   `json:"basic_auth" yaml:"basic_auth"`
	BasicAuthUser     string                 `json:"basic_auth_user" yaml:"basic_auth_user"`
	BasicAuthPassword string                 `json:"basic_auth_password" yaml:"basic_auth_password"`
	WithCredentials   bool                   `json:"with_credentials" yaml:"with_credentials"`
	IsDefault         bool                   `json:"is_default" yaml:"is_default"`
	JSONData          map[string]interface{} `json:"json_data" yaml:"json_data"`
	SecureJSONData    map[string]string      `json:"secure_json_data" yaml:"secure_json_data"`
	Editable          bool                   `json:"editable" yaml:"editable"`
}

type upsertDataSourceFromConfigV1 struct {
	OrgID             values.Int64Value     `json:"orgId" yaml:"orgId"`
	Version           values.IntValue       `json:"version" yaml:"version"`
	Name              values.StringValue    `json:"name" yaml:"name"`
	Type              values.StringValue    `json:"type" yaml:"type"`
	Access            values.StringValue    `json:"access" yaml:"access"`
	URL               values.StringValue    `json:"url" yaml:"url"`
	Password          values.StringValue    `json:"password" yaml:"password"`
	User              values.StringValue    `json:"user" yaml:"user"`
	Database          values.StringValue    `json:"database" yaml:"database"`
	BasicAuth         values.BoolValue      `json:"basicAuth" yaml:"basicAuth"`
	BasicAuthUser     values.StringValue    `json:"basicAuthUser" yaml:"basicAuthUser"`
	BasicAuthPassword values.StringValue    `json:"basicAuthPassword" yaml:"basicAuthPassword"`
	WithCredentials   values.BoolValue      `json:"withCredentials" yaml:"withCredentials"`
	IsDefault         values.BoolValue      `json:"isDefault" yaml:"isDefault"`
	JSONData          values.JSONValue      `json:"jsonData" yaml:"jsonData"`
	SecureJSONData    values.StringMapValue `json:"secureJsonData" yaml:"secureJsonData"`
	Editable          values.BoolValue      `json:"editable" yaml:"editable"`
	UID               values.StringValue    `json:"uid" yaml:"uid"`
}

func (cfg *configsV1) mapToDatasourceFromConfig(apiVersion int64) *configs {
	r := &configs{}

	r.APIVersion = apiVersion

	if cfg == nil {
		return r
	}

	for _, ds := range cfg.Datasources {
		r.Datasources = append(r.Datasources, &upsertDataSourceFromConfig{
			OrgID:             ds.OrgID.Value(),
			Name:              ds.Name.Value(),
			Type:              ds.Type.Value(),
			Access:            ds.Access.Value(),
			URL:               ds.URL.Value(),
			Password:          ds.Password.Value(),
			User:              ds.User.Value(),
			Database:          ds.Database.Value(),
			BasicAuth:         ds.BasicAuth.Value(),
			BasicAuthUser:     ds.BasicAuthUser.Value(),
			BasicAuthPassword: ds.BasicAuthPassword.Value(),
			WithCredentials:   ds.WithCredentials.Value(),
			IsDefault:         ds.IsDefault.Value(),
			JSONData:          ds.JSONData.Value(),
			SecureJSONData:    ds.SecureJSONData.Value(),
			Editable:          ds.Editable.Value(),
			Version:           ds.Version.Value(),
			UID:               ds.UID.Value(),
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
		r.DeleteDatasources = append(r.DeleteDatasources, &deleteDatasourceConfig{
			OrgID: ds.OrgID.Value(),
			Name:  ds.Name.Value(),
		})
	}

	return r
}

func (cfg *configsV0) mapToDatasourceFromConfig(apiVersion int64) *configs {
	r := &configs{}

	r.APIVersion = apiVersion

	if cfg == nil {
		return r
	}

	for _, ds := range cfg.Datasources {
		r.Datasources = append(r.Datasources, &upsertDataSourceFromConfig{
			OrgID:             ds.OrgID,
			Name:              ds.Name,
			Type:              ds.Type,
			Access:            ds.Access,
			URL:               ds.URL,
			Password:          ds.Password,
			User:              ds.User,
			Database:          ds.Database,
			BasicAuth:         ds.BasicAuth,
			BasicAuthUser:     ds.BasicAuthUser,
			BasicAuthPassword: ds.BasicAuthPassword,
			WithCredentials:   ds.WithCredentials,
			IsDefault:         ds.IsDefault,
			JSONData:          ds.JSONData,
			SecureJSONData:    ds.SecureJSONData,
			Editable:          ds.Editable,
			Version:           ds.Version,
		})
	}

	for _, ds := range cfg.DeleteDatasources {
		r.DeleteDatasources = append(r.DeleteDatasources, &deleteDatasourceConfig{
			OrgID: ds.OrgID,
			Name:  ds.Name,
		})
	}

	return r
}

func createInsertCommand(ds *upsertDataSourceFromConfig) *models.AddDataSourceCommand {
	jsonData := simplejson.New()
	if len(ds.JSONData) > 0 {
		for k, v := range ds.JSONData {
			jsonData.Set(k, v)
		}
	}

	return &models.AddDataSourceCommand{
		OrgId:             ds.OrgID,
		Name:              ds.Name,
		Type:              ds.Type,
		Access:            models.DsAccess(ds.Access),
		Url:               ds.URL,
		Password:          ds.Password,
		User:              ds.User,
		Database:          ds.Database,
		BasicAuth:         ds.BasicAuth,
		BasicAuthUser:     ds.BasicAuthUser,
		BasicAuthPassword: ds.BasicAuthPassword,
		WithCredentials:   ds.WithCredentials,
		IsDefault:         ds.IsDefault,
		JsonData:          jsonData,
		SecureJsonData:    ds.SecureJSONData,
		ReadOnly:          !ds.Editable,
		Uid:               ds.UID,
	}
}

func createUpdateCommand(ds *upsertDataSourceFromConfig, id int64) *models.UpdateDataSourceCommand {
	jsonData := simplejson.New()
	if len(ds.JSONData) > 0 {
		for k, v := range ds.JSONData {
			jsonData.Set(k, v)
		}
	}

	return &models.UpdateDataSourceCommand{
		Id:                id,
		Uid:               ds.UID,
		OrgId:             ds.OrgID,
		Name:              ds.Name,
		Type:              ds.Type,
		Access:            models.DsAccess(ds.Access),
		Url:               ds.URL,
		Password:          ds.Password,
		User:              ds.User,
		Database:          ds.Database,
		BasicAuth:         ds.BasicAuth,
		BasicAuthUser:     ds.BasicAuthUser,
		BasicAuthPassword: ds.BasicAuthPassword,
		WithCredentials:   ds.WithCredentials,
		IsDefault:         ds.IsDefault,
		JsonData:          jsonData,
		SecureJsonData:    ds.SecureJSONData,
		ReadOnly:          !ds.Editable,
	}
}
