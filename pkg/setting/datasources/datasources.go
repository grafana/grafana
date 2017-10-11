package datasources

import (
	"io/ioutil"
	"path/filepath"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"

	"github.com/grafana/grafana/pkg/models"
	yaml "gopkg.in/yaml.v2"
)

type DatasourcesAsConfig struct {
	PurgeOtherDatasources bool
	Datasources           []DataSourceFromConfig
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

	allDatasources, err := dc.repository.loadAllDatasources()
	if err != nil {
		return err
	}

	for i := range cfg.Datasources {
		if cfg.Datasources[i].OrgId == 0 {
			cfg.Datasources[i].OrgId = 1
		}
	}

	if err := dc.deleteDatasourcesNotInConfiguration(cfg, allDatasources); err != nil {
		return err
	}

	for _, ds := range cfg.Datasources {
		var dbDatasource *models.DataSource
		for _, ddd := range allDatasources {
			if ddd.Name == ds.Name && ddd.OrgId == ds.OrgId {
				dbDatasource = ddd
				break
			}
		}

		if dbDatasource == nil {
			dc.log.Info("inserting datasource from configuration ", "name", ds.Name)
			insertCmd := createInsertCommand(ds)
			if err := dc.repository.insert(insertCmd); err != nil {
				return err
			}
		} else {
			dc.log.Info("updating datasource from configuration", "name", ds.Name)
			updateCmd := createUpdateCommand(ds, dbDatasource.Id)
			if err := dc.repository.update(updateCmd); err != nil {
				return err
			}
		}
	}

	return nil
}

func (dc *DatasourceConfigurator) deleteDatasourcesNotInConfiguration(cfg *DatasourcesAsConfig, allDatasources []*models.DataSource) error {
	if cfg.PurgeOtherDatasources {
		for _, dbDS := range allDatasources {
			delete := true
			for _, cfgDS := range cfg.Datasources {
				if dbDS.Name == cfgDS.Name && dbDS.OrgId == cfgDS.OrgId {
					delete = false
				}
			}

			if delete {
				dc.log.Info("deleting datasource from configuration", "name", dbDS.Name)
				cmd := &models.DeleteDataSourceByIdCommand{Id: dbDS.Id, OrgId: dbDS.OrgId}
				if err := dc.repository.delete(cmd); err != nil {
					return err
				}
			}
		}
	}

	return nil
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
