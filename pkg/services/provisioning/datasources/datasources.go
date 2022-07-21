package datasources

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/provisioning/utils"
)

type Store interface {
	GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) error
	AddDataSource(ctx context.Context, cmd *datasources.AddDataSourceCommand) error
	UpdateDataSource(ctx context.Context, cmd *datasources.UpdateDataSourceCommand) error
	DeleteDataSource(ctx context.Context, cmd *datasources.DeleteDataSourceCommand) error
}

var (
	// ErrInvalidConfigToManyDefault indicates that multiple datasource in the provisioning files
	// contains more than one datasource marked as default.
	ErrInvalidConfigToManyDefault = errors.New("datasource.yaml config is invalid. Only one datasource per organization can be marked as default")
)

// Provision scans a directory for provisioning config files
// and provisions the datasource in those files.
func Provision(ctx context.Context, configDirectory string, store Store, orgStore utils.OrgStore) error {
	dc := newDatasourceProvisioner(log.New("provisioning.datasources"), store, orgStore)
	return dc.applyChanges(ctx, configDirectory)
}

// DatasourceProvisioner is responsible for provisioning datasources based on
// configuration read by the `configReader`
type DatasourceProvisioner struct {
	log         log.Logger
	cfgProvider *configReader
	store       Store
}

func newDatasourceProvisioner(log log.Logger, store Store, orgStore utils.OrgStore) DatasourceProvisioner {
	return DatasourceProvisioner{
		log:         log,
		cfgProvider: &configReader{log: log, orgStore: orgStore},
		store:       store,
	}
}

func (dc *DatasourceProvisioner) apply(ctx context.Context, cfg *configs) error {
	if err := dc.deleteDatasources(ctx, cfg.DeleteDatasources); err != nil {
		return err
	}

	for _, ds := range cfg.Datasources {
		cmd := &datasources.GetDataSourceQuery{OrgId: ds.OrgID, Name: ds.Name}
		err := dc.store.GetDataSource(ctx, cmd)
		if err != nil && !errors.Is(err, datasources.ErrDataSourceNotFound) {
			return err
		}

		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			insertCmd := createInsertCommand(ds)
			dc.log.Info("inserting datasource from configuration ", "name", insertCmd.Name, "uid", insertCmd.Uid)
			if err := dc.store.AddDataSource(ctx, insertCmd); err != nil {
				return err
			}
		} else {
			updateCmd := createUpdateCommand(ds, cmd.Result.Id)
			dc.log.Debug("updating datasource from configuration", "name", updateCmd.Name, "uid", updateCmd.Uid)
			if err := dc.store.UpdateDataSource(ctx, updateCmd); err != nil {
				return err
			}
		}
	}

	return nil
}

func (dc *DatasourceProvisioner) applyChanges(ctx context.Context, configPath string) error {
	configs, err := dc.cfgProvider.readConfig(ctx, configPath)
	if err != nil {
		return err
	}

	for _, cfg := range configs {
		if err := dc.apply(ctx, cfg); err != nil {
			return err
		}
	}

	return nil
}

func (dc *DatasourceProvisioner) deleteDatasources(ctx context.Context, dsToDelete []*deleteDatasourceConfig) error {
	for _, ds := range dsToDelete {
		cmd := &datasources.DeleteDataSourceCommand{OrgID: ds.OrgID, Name: ds.Name}
		if err := dc.store.DeleteDataSource(ctx, cmd); err != nil {
			return err
		}

		if cmd.DeletedDatasourcesCount > 0 {
			dc.log.Info("deleted datasource based on configuration", "name", ds.Name)
		}
	}

	return nil
}
