package datasources

import (
	"errors"
	"io/ioutil"
	"path/filepath"

	"github.com/grafana/grafana/pkg/bus"

	"github.com/grafana/grafana/pkg/log"

	"github.com/grafana/grafana/pkg/models"
	yaml "gopkg.in/yaml.v2"
)

var (
	ErrInvalidConfigToManyDefault = errors.New("datasource.yaml config is invalid. Only one datasource can be marked as default")
)

func Apply(configPath string) error {
	dc := NewDatasourceConfiguration()
	return dc.applyChanges(configPath)
}

type DatasourceConfigurator struct {
	log         log.Logger
	cfgProvider configProvider
}

func NewDatasourceConfiguration() DatasourceConfigurator {
	return newDatasourceConfiguration(log.New("setting.datasource"))
}

func newDatasourceConfiguration(log log.Logger) DatasourceConfigurator {
	return DatasourceConfigurator{
		log:         log,
		cfgProvider: configProvider{},
	}
}

func (dc *DatasourceConfigurator) applyChanges(configPath string) error {
	cfg, err := dc.cfgProvider.readConfig(configPath)
	if err != nil {
		return err
	}

	defaultCount := 0
	for i := range cfg.Datasources {
		if cfg.Datasources[i].OrgId == 0 {
			cfg.Datasources[i].OrgId = 1
		}

		if cfg.Datasources[i].IsDefault {
			defaultCount++
			if defaultCount > 1 {
				return ErrInvalidConfigToManyDefault
			}
		}
	}

	cmd := &models.GetAllDataSourcesQuery{}
	if err = bus.Dispatch(cmd); err != nil {
		return err
	}
	allDatasources := cmd.Result

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
			if err := bus.Dispatch(insertCmd); err != nil {
				return err
			}
		} else {
			dc.log.Debug("updating datasource from configuration", "name", ds.Name)
			updateCmd := createUpdateCommand(ds, dbDatasource.Id)
			if err := bus.Dispatch(updateCmd); err != nil {
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
				if err := bus.Dispatch(cmd); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

type configProvider struct{}

func (configProvider) readConfig(path string) (*DatasourcesAsConfig, error) {
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
