package datasources

import (
	"io/ioutil"
	"path/filepath"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"

	"github.com/grafana/grafana/pkg/models"
	yaml "gopkg.in/yaml.v2"
)

// TODO: secure jsonData
// TODO: auto reload on file changes
// TODO: remove get method since all datasources is in memory

type DatasourcesAsConfig struct {
	PurgeOtherDatasources bool
	Datasources           []models.DataSource
}

func Init(configPath string) error {
	dc := NewDatasourceConfiguration()
	return dc.applyChanges(configPath)
}

type DatasourceConfigurator struct {
	log         log.Logger
	cfgProvider configProvider
	repository  datasourceRepository
}

func NewDatasourceConfiguration() DatasourceConfigurator {
	return newDatasourceConfiguration(log.New("setting.datasource"), diskConfigReader{}, sqlDatasourceRepository{})
}

func newDatasourceConfiguration(log log.Logger, cfgProvider configProvider, repo datasourceRepository) DatasourceConfigurator {
	return DatasourceConfigurator{
		log:         log.New("setting.datasource"),
		repository:  repo,
		cfgProvider: cfgProvider,
	}
}

func (dc *DatasourceConfigurator) applyChanges(configPath string) error {
	cfg, err := dc.cfgProvider.readConfig(configPath)
	if err != nil {
		return err
	}

	all, err := dc.repository.loadAllDatasources()
	if err != nil {
		return err
	}

	for i, _ := range cfg.Datasources {
		if cfg.Datasources[i].OrgId == 0 {
			cfg.Datasources[i].OrgId = 1
		}
	}

	if cfg.PurgeOtherDatasources {
		for _, dbDatasource := range all {
			delete := true
			for _, cfgDatasource := range cfg.Datasources {
				if dbDatasource.Name == cfgDatasource.Name && dbDatasource.OrgId == cfgDatasource.OrgId {
					delete = false
				}
			}

			if delete {
				dc.log.Info("deleting datasource since PurgeOtherDatasource is enabled", "name", dbDatasource.Name)
				dc.repository.delete(&models.DeleteDataSourceByIdCommand{Id: dbDatasource.Id, OrgId: dbDatasource.OrgId})
			}
		}
	}

	for _, ds := range cfg.Datasources {

		query := &models.GetDataSourceByNameQuery{Name: ds.Name, OrgId: ds.OrgId}
		err := dc.repository.get(query)
		if err != nil && err != models.ErrDataSourceNotFound {
			return err
		}

		if query.Result == nil {
			dc.log.Info("inserting ", "name", ds.Name)
			insertCmd := createInsertCommand(ds)
			if err := dc.repository.insert(insertCmd); err != nil {
				return err
			}
		} else {
			dc.log.Info("updating", "name", ds.Name)
			updateCmd := createUpdateCommand(ds, query.Result.Id)
			if err := dc.repository.update(updateCmd); err != nil {
				return err
			}
		}
	}

	return nil
}

func createInsertCommand(ds models.DataSource) *models.AddDataSourceCommand {
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

func createUpdateCommand(ds models.DataSource, id int64) *models.UpdateDataSourceCommand {
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

type datasourceRepository interface {
	insert(*models.AddDataSourceCommand) error
	update(*models.UpdateDataSourceCommand) error
	delete(*models.DeleteDataSourceByIdCommand) error
	get(*models.GetDataSourceByNameQuery) error
	loadAllDatasources() ([]*models.DataSource, error)
}

type configProvider interface {
	readConfig(string) (*DatasourcesAsConfig, error)
}

type sqlDatasourceRepository struct{}
type diskConfigReader struct{}

func (diskConfigReader) readConfig(path string) (*DatasourcesAsConfig, error) {
	filename, _ := filepath.Abs(path)
	yamlFile, err := ioutil.ReadFile(filename)

	if err != nil {
		return nil, err
	}

	var datasources *DatasourcesAsConfig

	err = yaml.Unmarshal(yamlFile, &datasources)
	if err != nil {
		return nil, err
	}

	return datasources, nil
}

func (sqlDatasourceRepository) delete(cmd *models.DeleteDataSourceByIdCommand) error {
	return bus.Dispatch(cmd)
}

func (sqlDatasourceRepository) update(cmd *models.UpdateDataSourceCommand) error {
	return bus.Dispatch(cmd)
}

func (sqlDatasourceRepository) insert(cmd *models.AddDataSourceCommand) error {
	return bus.Dispatch(cmd)
}

func (sqlDatasourceRepository) get(cmd *models.GetDataSourceByNameQuery) error {
	return bus.Dispatch(cmd)
}

func (sqlDatasourceRepository) loadAllDatasources() ([]*models.DataSource, error) {
	dss := &models.GetAllDataSourcesQuery{}
	if err := bus.Dispatch(dss); err != nil {
		return nil, err
	}

	return dss.Result, nil
}
