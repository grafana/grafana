package datasources

import (
	"io"
	"io/ioutil"
	"path/filepath"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"

	"github.com/grafana/grafana/pkg/models"
	yaml "gopkg.in/yaml.v2"
)

var (
	logger log.Logger
)

// TODO: secure jsonData
// TODO: auto reload on file changes

func Init(configPath string) (error, io.Closer) {
	logger = log.New("setting.datasource")

	datasources, err := readDatasources(configPath)
	if err != nil {
		return err, ioutil.NopCloser(nil)
	}

	for _, ds := range datasources {
		query := &models.GetDataSourceByNameQuery{Name: ds.Name}
		err := bus.Dispatch(query)
		if err != nil && err != models.ErrDataSourceNotFound {
			return err, ioutil.NopCloser(nil)
		}

		if ds.OrgId == 0 {
			ds.OrgId = 1
		}

		if query.Result == nil {
			logger.Info("inserting ", "name", ds.Name)
			insertCmd := insertCommand(ds)
			if err := bus.Dispatch(insertCmd); err != nil {
				return err, ioutil.NopCloser(nil)
			}
		} else {
			logger.Info("updating", "name", ds.Name)
			updateCmd := updateCommand(ds, query.Result.Id)
			if err := bus.Dispatch(updateCmd); err != nil {
				return err, ioutil.NopCloser(nil)
			}
		}
	}

	return nil, ioutil.NopCloser(nil)
}

func readDatasources(path string) ([]models.DataSource, error) {
	filename, _ := filepath.Abs(path)
	yamlFile, err := ioutil.ReadFile(filename)

	if err != nil {
		return nil, err
	}

	var datasources []models.DataSource

	err = yaml.Unmarshal(yamlFile, &datasources)
	if err != nil {
		return nil, err
	}

	return datasources, nil
}

func insertCommand(ds models.DataSource) *models.AddDataSourceCommand {
	return &models.AddDataSourceCommand{
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
	}
}

func updateCommand(ds models.DataSource, id int64) *models.UpdateDataSourceCommand {
	return &models.UpdateDataSourceCommand{
		Id:                id,
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
	}
}
