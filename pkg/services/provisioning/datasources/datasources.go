package datasources

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org"
	jsoniter "github.com/json-iterator/go"
)

type Store interface {
	GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) (*datasources.DataSource, error)
	AddDataSource(ctx context.Context, cmd *datasources.AddDataSourceCommand) (*datasources.DataSource, error)
	UpdateDataSource(ctx context.Context, cmd *datasources.UpdateDataSourceCommand) (*datasources.DataSource, error)
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
func Provision(ctx context.Context, configDirectory string, store Store, correlationsStore CorrelationsStore, orgService org.Service) error {
	dc := newDatasourceProvisioner(log.New("provisioning.datasources"), store, correlationsStore, orgService)
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

func newDatasourceProvisioner(log log.Logger, store Store, correlationsStore CorrelationsStore, orgService org.Service) DatasourceProvisioner {
	return DatasourceProvisioner{
		log:               log,
		cfgProvider:       &configReader{log: log, orgService: orgService},
		store:             store,
		correlationsStore: correlationsStore,
	}
}

func (dc *DatasourceProvisioner) provisionDataSources(ctx context.Context, cfg *configs, ultimatelyDeleted map[DataSourceMapKey]bool) error {
	if err := dc.deleteDatasources(ctx, cfg.DeleteDatasources, ultimatelyDeleted); err != nil {
		return err
	}

	for _, ds := range cfg.Datasources {
		cmd := &datasources.GetDataSourceQuery{OrgID: ds.OrgID, Name: ds.Name}
		dataSource, err := dc.store.GetDataSource(ctx, cmd)
		if err != nil && !errors.Is(err, datasources.ErrDataSourceNotFound) {
			return err
		}

		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			insertCmd := createInsertCommand(ds)
			dc.log.Info("inserting datasource from configuration ", "name", insertCmd.Name, "uid", insertCmd.UID)
			_, err = dc.store.AddDataSource(ctx, insertCmd)
			if err != nil {
				return err
			}
		} else {
			updateCmd := createUpdateCommand(ds, dataSource.ID)
			dc.log.Debug("updating datasource from configuration", "name", updateCmd.Name, "uid", updateCmd.UID)
			if _, err := dc.store.UpdateDataSource(ctx, updateCmd); err != nil {
				return err
			}
		}
	}

	return nil
}

func (dc *DatasourceProvisioner) provisionCorrelations(ctx context.Context, cfg *configs) error {
	for _, ds := range cfg.Datasources {
		cmd := &datasources.GetDataSourceQuery{OrgID: ds.OrgID, Name: ds.Name}
		dataSource, err := dc.store.GetDataSource(ctx, cmd)

		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			return err
		}

		if err := dc.correlationsStore.DeleteCorrelationsBySourceUID(ctx, correlations.DeleteCorrelationsBySourceUIDCommand{
			SourceUID:       dataSource.UID,
			OrgId:           dataSource.OrgID,
			OnlyProvisioned: true,
		}); err != nil {
			return err
		}

		for _, correlation := range ds.Correlations {
			createCorrelationCmd, err := makeCreateCorrelationCommand(correlation, dataSource.UID, dataSource.OrgID)
			if err != nil {
				dc.log.Error("failed to parse correlation", "correlation", correlation)
				return err
			}
			if _, err := dc.correlationsStore.CreateCorrelation(ctx, createCorrelationCmd); err != nil {
				return fmt.Errorf("err=%s source=%s", err.Error(), createCorrelationCmd.SourceUID)
			}
		}
	}
	return nil
}

type DataSourceMapKey struct {
	Name  string
	OrgId int64
}

func (dc *DatasourceProvisioner) applyChanges(ctx context.Context, configPath string) error {
	configs, err := dc.cfgProvider.readConfig(ctx, configPath)
	if err != nil {
		return err
	}

	// Creates a list of data sources that will be ultimately deleted after provisioning finishes
	ultimatelyDeletedMap := map[DataSourceMapKey]bool{}
	for _, cfg := range configs {
		for _, ds := range cfg.DeleteDatasources {
			ultimatelyDeletedMap[DataSourceMapKey{Name: ds.Name, OrgId: ds.OrgID}] = true
		}
		for _, ds := range cfg.Datasources {
			ultimatelyDeletedMap[DataSourceMapKey{Name: ds.Name, OrgId: ds.OrgID}] = false
		}
	}

	for _, cfg := range configs {
		if err := dc.provisionDataSources(ctx, cfg, ultimatelyDeletedMap); err != nil {
			return err
		}
	}

	for _, cfg := range configs {
		if err := dc.provisionCorrelations(ctx, cfg); err != nil {
			return err
		}
	}

	return nil
}

func makeCreateCorrelationCommand(correlation map[string]interface{}, SourceUID string, OrgId int64) (correlations.CreateCorrelationCommand, error) {
	var json = jsoniter.ConfigCompatibleWithStandardLibrary
	createCommand := correlations.CreateCorrelationCommand{
		SourceUID:   SourceUID,
		Label:       correlation["label"].(string),
		Description: correlation["description"].(string),
		OrgId:       OrgId,
		Provisioned: true,
	}

	targetUID, ok := correlation["targetUID"].(string)
	if ok {
		createCommand.TargetUID = &targetUID
	}

	if correlation["transformations"] != nil {
		return correlations.CreateCorrelationCommand{}, correlations.ErrTransformationNotNested
	}

	if correlation["config"] != nil {
		jsonbody, err := json.Marshal(correlation["config"])
		if err != nil {
			return correlations.CreateCorrelationCommand{}, err
		}

		config := correlations.CorrelationConfig{}
		if err := json.Unmarshal(jsonbody, &config); err != nil {
			return correlations.CreateCorrelationCommand{}, err
		}

		createCommand.Config = config
	} else {
		// when provisioning correlations without config we default to type="query"
		createCommand.Config = correlations.CorrelationConfig{
			Type: correlations.ConfigTypeQuery,
		}
	}
	if err := createCommand.Validate(); err != nil {
		return correlations.CreateCorrelationCommand{}, err
	}

	return createCommand, nil
}

func (dc *DatasourceProvisioner) deleteDatasources(ctx context.Context, dsToDelete []*deleteDatasourceConfig, ultimatelyDeleted map[DataSourceMapKey]bool) error {
	for _, ds := range dsToDelete {
		getDsQuery := &datasources.GetDataSourceQuery{Name: ds.Name, OrgID: ds.OrgID}
		_, err := dc.store.GetDataSource(ctx, getDsQuery)

		if err != nil && !errors.Is(err, datasources.ErrDataSourceNotFound) {
			return err
		}

		// Skip publishing the event as the data source is not really deleted, it will be re-created during provisioning
		// This is to avoid cleaning up correlations related to the data source
		isUltimatelyDeleted := ultimatelyDeleted[DataSourceMapKey{Name: ds.Name, OrgId: ds.OrgID}]
		cmd := &datasources.DeleteDataSourceCommand{OrgID: ds.OrgID, Name: ds.Name, SkipPublish: !isUltimatelyDeleted}
		if err := dc.store.DeleteDataSource(ctx, cmd); err != nil {
			return err
		}

		if cmd.DeletedDatasourcesCount > 0 {
			dc.log.Info("deleted datasource based on configuration", "name", ds.Name)
		}
	}

	return nil
}
