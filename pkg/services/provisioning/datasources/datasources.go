package datasources

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/provisioning/utils"
)

type Store interface {
	GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) error
	AddDataSource(ctx context.Context, cmd *datasources.AddDataSourceCommand) error
	UpdateDataSource(ctx context.Context, cmd *datasources.UpdateDataSourceCommand) error
	DeleteDataSource(ctx context.Context, cmd *datasources.DeleteDataSourceCommand) error
}

type CorrelationsStore interface {
	DeleteCorrelationsByTargetUID(ctx context.Context, cmd correlations.DeleteCorrelationsByTargetUIDCommand) error
	DeleteCorrelationsBySourceUID(ctx context.Context, cmd correlations.DeleteCorrelationsBySourceUIDCommand) error
	CreateCorrelation(ctx context.Context, cmd correlations.CreateCorrelationCommand) (correlations.Correlation, error)
}

var (
	// ErrInvalidConfigToManyDefault indicates that multiple datasource in the provisioning files
	// contains more than one datasource marked as default.
	ErrInvalidConfigToManyDefault = errors.New("datasource.yaml config is invalid. Only one datasource per organization can be marked as default")
)

// Provision scans a directory for provisioning config files
// and provisions the datasource in those files.
func Provision(ctx context.Context, configDirectory string, store Store, correlationsStore CorrelationsStore, orgStore utils.OrgStore) error {
	dc := newDatasourceProvisioner(log.New("provisioning.datasources"), store, correlationsStore, orgStore)
	return dc.applyChanges(ctx, configDirectory)
}

// DatasourceProvisioner is responsible for provisioning datasources based on
// configuration read by the `configReader`
type DatasourceProvisioner struct {
	log               log.Logger
	cfgProvider       *configReader
	store             Store
	correlationsStore CorrelationsStore
}

func newDatasourceProvisioner(log log.Logger, store Store, correlationsStore CorrelationsStore, orgStore utils.OrgStore) DatasourceProvisioner {
	return DatasourceProvisioner{
		log:               log,
		cfgProvider:       &configReader{log: log, orgStore: orgStore},
		store:             store,
		correlationsStore: correlationsStore,
	}
}

func (dc *DatasourceProvisioner) apply(ctx context.Context, cfg *configs) error {
	if err := dc.deleteDatasources(ctx, cfg.DeleteDatasources); err != nil {
		return err
	}

	correlationsToInsert := make([]correlations.CreateCorrelationCommand, 0)

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

			for _, correlation := range ds.Correlations {
				if insertCorrelationCmd, err := makeCreateCorrelationCommand(correlation, insertCmd.Result.Uid, insertCmd.OrgId); err == nil {
					correlationsToInsert = append(correlationsToInsert, insertCorrelationCmd)
				} else {
					dc.log.Error("failed to parse correlation", "correlation", correlation)
					return err
				}
			}
		} else {
			updateCmd := createUpdateCommand(ds, cmd.Result.Id)
			dc.log.Debug("updating datasource from configuration", "name", updateCmd.Name, "uid", updateCmd.Uid)
			if err := dc.store.UpdateDataSource(ctx, updateCmd); err != nil {
				return err
			}

			if len(ds.Correlations) > 0 {
				if err := dc.correlationsStore.DeleteCorrelationsBySourceUID(ctx, correlations.DeleteCorrelationsBySourceUIDCommand{
					SourceUID: cmd.Result.Uid,
				}); err != nil {
					return err
				}
			}

			for _, correlation := range ds.Correlations {
				if insertCorrelationCmd, err := makeCreateCorrelationCommand(correlation, cmd.Result.Uid, updateCmd.OrgId); err == nil {
					correlationsToInsert = append(correlationsToInsert, insertCorrelationCmd)
				} else {
					dc.log.Error("failed to parse correlation", "correlation", correlation)
					return err
				}
			}
		}
	}

	for _, createCorrelationCmd := range correlationsToInsert {
		if _, err := dc.correlationsStore.CreateCorrelation(ctx, createCorrelationCmd); err != nil {
			return fmt.Errorf("err=%s source=%s", err.Error(), createCorrelationCmd.SourceUID)
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

func makeCreateCorrelationCommand(correlation map[string]interface{}, SourceUid string, OrgId int64) (correlations.CreateCorrelationCommand, error) {
	targetUID, ok := correlation["targetUID"].(string)
	if !ok {
		return correlations.CreateCorrelationCommand{}, fmt.Errorf("correlation missing targetUID")
	}

	return correlations.CreateCorrelationCommand{
		SourceUID:         SourceUid,
		TargetUID:         targetUID,
		Label:             correlation["label"].(string),
		Description:       correlation["description"].(string),
		OrgId:             OrgId,
		SkipReadOnlyCheck: true,
	}, nil
}

func (dc *DatasourceProvisioner) deleteDatasources(ctx context.Context, dsToDelete []*deleteDatasourceConfig) error {
	for _, ds := range dsToDelete {
		cmd := &datasources.DeleteDataSourceCommand{OrgID: ds.OrgID, Name: ds.Name}
		getDsQuery := &datasources.GetDataSourceQuery{Name: ds.Name, OrgId: ds.OrgID}
		if err := dc.store.GetDataSource(ctx, getDsQuery); err != nil && !errors.Is(err, datasources.ErrDataSourceNotFound) {
			return err
		}

		if err := dc.store.DeleteDataSource(ctx, cmd); err != nil {
			return err
		}

		if getDsQuery.Result != nil {
			if err := dc.correlationsStore.DeleteCorrelationsBySourceUID(ctx, correlations.DeleteCorrelationsBySourceUIDCommand{
				SourceUID: getDsQuery.Result.Uid,
			}); err != nil {
				return err
			}

			if err := dc.correlationsStore.DeleteCorrelationsByTargetUID(ctx, correlations.DeleteCorrelationsByTargetUIDCommand{
				TargetUID: getDsQuery.Result.Uid,
			}); err != nil {
				return err
			}

			dc.log.Info("deleted correlations based on configuration", "ds_name", ds.Name)
		}

		if cmd.DeletedDatasourcesCount > 0 {
			dc.log.Info("deleted datasource based on configuration", "name", ds.Name)
		}
	}

	return nil
}
