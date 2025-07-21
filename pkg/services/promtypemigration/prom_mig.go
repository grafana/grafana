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
	//some how check if migration needs to happen
	logger.Debug("performing prometheus data source type migration")
	query := &datasources.GetDataSourcesByTypeQuery{
		Type: datasources.DS_PROMETHEUS,
	}
	dsList, err := s.dataSourcesService.GetDataSourcesByType(ctx, query)
	if err != nil {
		return err
	}

	for _, ds := range dsList {
		if _, found := ds.JsonData.CheckGet("azureCredentials"); !found {
			continue
		}
		secureJsonData, err := s.dataSourcesService.DecryptedValues(ctx, ds)
		if err != nil {
			return err
		}
		_, err = s.dataSourcesService.UpdateDataSource(ctx, &datasources.UpdateDataSourceCommand{
			ID:             ds.ID,
			Type:           "grafana-azureprometheus-datasource",
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
		if err != nil {
			return err
		}
	}

	logger.Debug("prometheus data source type migration complete")

	return nil
}
