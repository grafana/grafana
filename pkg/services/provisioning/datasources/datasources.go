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

type BaseDataSourceService interface {
	GetDataSource(ctx context.Context, query *datasources.GetDataSourceQuery) (*datasources.DataSource, error)
	GetPrunableProvisionedDataSources(ctx context.Context) ([]*datasources.DataSource, error)
	AddDataSource(ctx context.Context, cmd *datasources.AddDataSourceCommand) (*datasources.DataSource, error)
	UpdateDataSource(ctx context.Context, cmd *datasources.UpdateDataSourceCommand) (*datasources.DataSource, error)
	DeleteDataSource(ctx context.Context, cmd *datasources.DeleteDataSourceCommand) error
}

type CorrelationsStore interface {
	DeleteCorrelationsByTargetUID(ctx context.Context, cmd correlations.DeleteCorrelationsByTargetUIDCommand) error
	DeleteCorrelationsBySourceUID(ctx context.Context, cmd correlations.DeleteCorrelationsBySourceUIDCommand) error
	CreateCorrelation(ctx context.Context, cmd correlations.CreateCorrelationCommand) (correlations.Correlation, error)
	CreateOrUpdateCorrelation(ctx context.Context, cmd correlations.CreateCorrelationCommand) error
}

var (
	// ErrInvalidConfigToManyDefault indicates that multiple datasource in the provisioning files
	// contains more than one datasource marked as default.
	ErrInvalidConfigToManyDefault = errors.New("datasource.yaml config is invalid. Only one datasource per organization can be marked as default")
)

// Provision scans a directory for provisioning config files
// and provisions the datasource in those files.
func Provision(ctx context.Context, configDirectory string, dsService BaseDataSourceService, correlationsStore CorrelationsStore, orgService org.Service) error {
	dc := newDatasourceProvisioner(log.New("provisioning.datasources"), dsService, correlationsStore, orgService)
	return dc.applyChanges(ctx, configDirectory)
}

// DatasourceProvisioner is responsible for provisioning datasources based on
// configuration read by the `configReader`
type DatasourceProvisioner struct {
	log               log.Logger
	cfgProvider       *configReader
	dsService         BaseDataSourceService
	correlationsStore CorrelationsStore
}

func newDatasourceProvisioner(log log.Logger, dsService BaseDataSourceService, correlationsStore CorrelationsStore, orgService org.Service) DatasourceProvisioner {
	return DatasourceProvisioner{
		log:               log,
		cfgProvider:       &configReader{log: log, orgService: orgService},
		dsService:         dsService,
		correlationsStore: correlationsStore,
	}
}

func (dc *DatasourceProvisioner) provisionDataSources(ctx context.Context, cfg *configs, willExistAfterProvisioning map[DataSourceMapKey]bool) error {
	if err := dc.deleteDatasources(ctx, cfg.DeleteDatasources, willExistAfterProvisioning); err != nil {
		return err
	}

	for _, ds := range cfg.Datasources {
		cmd := &datasources.GetDataSourceQuery{OrgID: ds.OrgID, Name: ds.Name}
		dataSource, err := dc.dsService.GetDataSource(ctx, cmd)
		if err != nil && !errors.Is(err, datasources.ErrDataSourceNotFound) {
			return err
		}

		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			insertCmd := createInsertCommand(ds)
			dc.log.Info("inserting datasource from configuration", "name", insertCmd.Name, "uid", insertCmd.UID)
			_, err = dc.dsService.AddDataSource(ctx, insertCmd)
			if err != nil {
				return err
			}
		} else {
			updateCmd := createUpdateCommand(ds, dataSource.ID)
			dc.log.Debug("updating datasource from configuration", "name", updateCmd.Name, "uid", updateCmd.UID)
			if _, err := dc.dsService.UpdateDataSource(ctx, updateCmd); err != nil {
				if errors.Is(err, datasources.ErrDataSourceUpdatingOldVersion) {
					dc.log.Debug("ignoring old version of datasource", "name", updateCmd.Name, "uid", updateCmd.UID)
				} else {
					return err
				}
			}
		}
	}

	return nil
}

func (dc *DatasourceProvisioner) provisionCorrelations(ctx context.Context, cfg *configs) error {
	for _, ds := range cfg.Datasources {
		cmd := &datasources.GetDataSourceQuery{OrgID: ds.OrgID, Name: ds.Name}
		dataSource, err := dc.dsService.GetDataSource(ctx, cmd)

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
			// "Provisioned" column was introduced in #71110. Any records that were created before this change
			// are marked as "not provisioned". To avoid duplicates we ensure these records are updated instead
			// of being inserted once again with Provisioned=true.
			// This is required to help users upgrade with confidence. Post GA we do not expect this code to be
			// needed at all as it should result in a no-op. This should be mentioned in what's new docs when
			// feature becomes GA.
			// This can be changed to dc.correlationsStore.CreateCorrelation in Grafana 11 and CreateOrUpdateCorrelation
			// can be removed.
			if err := dc.correlationsStore.CreateOrUpdateCorrelation(ctx, createCorrelationCmd); err != nil {
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
	willExistAfterProvisioning := map[DataSourceMapKey]bool{}
	for _, cfg := range configs {
		for _, ds := range cfg.DeleteDatasources {
			willExistAfterProvisioning[DataSourceMapKey{Name: ds.Name, OrgId: ds.OrgID}] = false
		}
		for _, ds := range cfg.Datasources {
			willExistAfterProvisioning[DataSourceMapKey{Name: ds.Name, OrgId: ds.OrgID}] = true
		}
	}

	prunableProvisionedDataSources, err := dc.dsService.GetPrunableProvisionedDataSources(ctx)
	if err != nil {
		return err
	}

	staleProvisionedDataSources := []*deleteDatasourceConfig{}

	for _, prunableProvisionedDataSource := range prunableProvisionedDataSources {
		key := DataSourceMapKey{
			OrgId: prunableProvisionedDataSource.OrgID,
			Name:  prunableProvisionedDataSource.Name,
		}
		if _, ok := willExistAfterProvisioning[key]; !ok {
			staleProvisionedDataSources = append(staleProvisionedDataSources, &deleteDatasourceConfig{OrgID: prunableProvisionedDataSource.OrgID, Name: prunableProvisionedDataSource.Name})
			willExistAfterProvisioning[key] = false
		}
	}

	if err := dc.deleteDatasources(ctx, staleProvisionedDataSources, willExistAfterProvisioning); err != nil {
		return err
	}

	for _, cfg := range configs {
		if err := dc.provisionDataSources(ctx, cfg, willExistAfterProvisioning); err != nil {
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

func makeCreateCorrelationCommand(correlation map[string]any, SourceUID string, OrgId int64) (correlations.CreateCorrelationCommand, error) {
	// we look for a correlation type at the root if it is defined, if not use default
	// we ignore the legacy config.type value - the only valid value at that version was "query"
	var corrType = correlation["type"]
	if corrType == nil || corrType == "" {
		corrType = correlations.CorrelationType("query")
	}

	var json = jsoniter.ConfigCompatibleWithStandardLibrary
	createCommand := correlations.CreateCorrelationCommand{
		SourceUID:   SourceUID,
		Label:       correlation["label"].(string),
		Description: correlation["description"].(string),
		OrgId:       OrgId,
		Provisioned: true,
		Type:        corrType.(correlations.CorrelationType),
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

		// config.type is a deprecated place for this value. We will default it to "query" for legacy purposes but non-query correlations should have type outside of config
		if config.Type != correlations.CorrelationType("query") {
			return correlations.CreateCorrelationCommand{}, correlations.ErrInvalidConfigType
		}

		createCommand.Config = config
	}
	if err := createCommand.Validate(); err != nil {
		return correlations.CreateCorrelationCommand{}, err
	}

	return createCommand, nil
}

func (dc *DatasourceProvisioner) deleteDatasources(ctx context.Context, dsToDelete []*deleteDatasourceConfig, willExistAfterProvisioning map[DataSourceMapKey]bool) error {
	for _, ds := range dsToDelete {
		getDsQuery := &datasources.GetDataSourceQuery{Name: ds.Name, OrgID: ds.OrgID}
		existingDs, err := dc.dsService.GetDataSource(ctx, getDsQuery)

		if err != nil {
			if errors.Is(err, datasources.ErrDataSourceNotFound) {
				continue
			} else {
				return err
			}
		}

		// Skip publishing the event as the data source is not really deleted, it will be re-created during provisioning
		// This is to avoid cleaning up any resources related to the data source (e.g. correlations)
		skipPublish := willExistAfterProvisioning[DataSourceMapKey{Name: ds.Name, OrgId: ds.OrgID}]
		cmd := &datasources.DeleteDataSourceCommand{OrgID: ds.OrgID, Name: ds.Name, UID: existingDs.UID, SkipPublish: skipPublish}
		if err := dc.dsService.DeleteDataSource(ctx, cmd); err != nil {
			return err
		}

		if cmd.DeletedDatasourcesCount > 0 {
			dc.log.Info("deleted datasource based on configuration", "name", ds.Name)
		}
	}

	return nil
}
