package datasources

import (
	"errors"

	"github.com/grafana/grafana/pkg/bus"

	"github.com/grafana/grafana/pkg/infra/log"

	"github.com/grafana/grafana/pkg/models"
)

var (
	// ErrInvalidConfigToManyDefault indicates that multiple datasource in the provisioning files
	// contains more than one datasource marked as default.
	ErrInvalidConfigToManyDefault = errors.New("datasource.yaml config is invalid. Only one datasource per organization can be marked as default")
)

// Provision scans a directory for provisioning config files
// and provisions the datasource in those files.
func Provision(configDirectory string) error {
	dc := newDatasourceProvisioner(log.New("provisioning.datasources"))
	return dc.applyChanges(configDirectory)
}

// DatasourceProvisioner is responsible for provisioning datasources based on
// configuration read by the `configReader`
type DatasourceProvisioner struct {
	log         log.Logger
	cfgProvider *configReader
}

func newDatasourceProvisioner(log log.Logger) DatasourceProvisioner {
	return DatasourceProvisioner{
		log:         log,
		cfgProvider: &configReader{log: log},
	}
}

func (dc *DatasourceProvisioner) apply(cfg *configs) error {
	if err := dc.deleteDatasources(cfg.DeleteDatasources); err != nil {
		return err
	}

	for _, ds := range cfg.Datasources {
		cmd := &models.GetDataSourceByNameQuery{OrgId: ds.OrgID, Name: ds.Name}
		err := bus.Dispatch(cmd)
		if err != nil && err != models.ErrDataSourceNotFound {
			return err
		}

		if err == models.ErrDataSourceNotFound {
			dc.log.Info("inserting datasource from configuration ", "name", ds.Name, "uid", ds.UID)
			insertCmd := createInsertCommand(ds)
			if err := bus.Dispatch(insertCmd); err != nil {
				return err
			}
		} else {
			dc.log.Debug("updating datasource from configuration", "name", ds.Name, "uid", ds.UID)
			updateCmd := createUpdateCommand(ds, cmd.Result.Id)
			if err := bus.Dispatch(updateCmd); err != nil {
				return err
			}
		}
	}

	return nil
}

func (dc *DatasourceProvisioner) applyChanges(configPath string) error {
	configs, err := dc.cfgProvider.readConfig(configPath)
	if err != nil {
		return err
	}

	for _, cfg := range configs {
		if err := dc.apply(cfg); err != nil {
			return err
		}
	}

	return nil
}

func (dc *DatasourceProvisioner) deleteDatasources(dsToDelete []*deleteDatasourceConfig) error {
	for _, ds := range dsToDelete {
		cmd := &models.DeleteDataSourceByNameCommand{OrgId: ds.OrgID, Name: ds.Name}
		if err := bus.Dispatch(cmd); err != nil {
			return err
		}

		if cmd.DeletedDatasourcesCount > 0 {
			dc.log.Info("deleted datasource based on configuration", "name", ds.Name)
		}
	}

	return nil
}
