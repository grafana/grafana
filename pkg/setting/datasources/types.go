package datasources

import "github.com/grafana/grafana/pkg/models"
import "github.com/grafana/grafana/pkg/components/simplejson"

type DataSourceFromConfig struct {
	Id      int64
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
	JsonData          string
	SecureJsonData    map[string]string
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
	}
}
