package promtypemigration

import (
	"context"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type PromMigrationService struct {
	dataSourcesService datasources.DataSourceService
	features           featuremgmt.FeatureToggles
}

func ProvidePromMigrationService(
	dataSourcesService datasources.DataSourceService,
	features featuremgmt.FeatureToggles,
) *PromMigrationService {
	return &PromMigrationService{
		dataSourcesService: dataSourcesService,
		features:           features,
	}
}

func (s *PromMigrationService) Migrate(ctx context.Context) error {
	//feature flag check
	//if stuiff

	//check to see if azure/aws is available
	//s.dataSourcesService
	const azurePromExists = false
	const amazonPromExists = false
	if !azurePromExists && !amazonPromExists {
		return nil
	}

	logger.Debug("performing prometheus data source type migration")

	query := &datasources.GetDataSourcesByTypeQuery{
		Type: datasources.DS_PROMETHEUS,
	}
	dsList, err := s.dataSourcesService.GetDataSourcesByType(ctx, query)
	if err != nil {
		return err
	}

	for _, ds := range dsList {
		if _, found := ds.JsonData.CheckGet("azureCredentials"); azurePromExists && found {
			err = updateDataSourceType(ctx, s.dataSourcesService, ds, "grafana-azureprometheus-datasource")
			if err != nil {
				return err
			}
			continue
		}
		if sigV4Auth, found := ds.JsonData.CheckGet("sigV4Auth"); amazonPromExists && found {
			if enabled, err := sigV4Auth.Bool(); err != nil || !enabled {
				continue
			}
			err = updateDataSourceType(ctx, s.dataSourcesService, ds, "grafana-amazonprometheus-datasource")
			if err != nil {
				return err
			}
			continue
		}
	}

	logger.Debug("prometheus data source type migration complete")

	return nil
}

func updateDataSourceType(ctx context.Context, service datasources.DataSourceService, ds *datasources.DataSource, newType string) error {
	secureJsonData, err := service.DecryptedValues(ctx, ds)
	if err != nil {
		return err
	}
	ds.JsonData.Set("prometheus-type-migration", true)
	_, err = service.UpdateDataSource(ctx, &datasources.UpdateDataSourceCommand{
		ID:             ds.ID,
		Type:           newType,
		OrgID:          ds.OrgID,
		UID:            ds.UID,
		Name:           ds.Name,
		JsonData:       ds.JsonData,
		SecureJsonData: secureJsonData,

		// These are needed by the SQL function due to UseBool and MustCols
		IsDefault:       ds.IsDefault,
		BasicAuth:       ds.BasicAuth,
		WithCredentials: ds.WithCredentials,
		ReadOnly:        ds.ReadOnly,
		User:            ds.User,
		Database:        ds.Database,
	})
	return err
}
