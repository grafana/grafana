package service

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type DataSourceSecretMigrationService struct {
	dataSourcesService datasources.DataSourceService
	kvStore            kvstore.KVStore
	features           featuremgmt.FeatureToggles
}

func ProvideDataSourceMigrationService(
	dataSourcesService datasources.DataSourceService,
	kvStore kvstore.KVStore,
	features featuremgmt.FeatureToggles,
) *DataSourceSecretMigrationService {
	return &DataSourceSecretMigrationService{
		dataSourcesService: dataSourcesService,
		kvStore:            kvStore,
		features:           features,
	}
}

func (s *DataSourceSecretMigrationService) Migrate(ctx context.Context) error {
	migrationStatus, _, err := s.kvStore.Get(ctx, 0, secretType, "secretMigrationStatus")
	if err != nil {
		return err
	}

	disableSecretsCompatibility := s.features.IsEnabled("disableSecretsCompatibility")
	needCompatibility := migrationStatus != "compatible" && !disableSecretsCompatibility
	needMigration := migrationStatus != "complete" && disableSecretsCompatibility

	if needCompatibility || needMigration {
		query := &datasources.GetAllDataSourcesQuery{}
		err := s.dataSourcesService.GetAllDataSources(ctx, query)
		if err != nil {
			return err
		}

		for _, ds := range query.Result {
			secureJsonData, err := s.dataSourcesService.DecryptedValues(ctx, ds)
			if err != nil {
				return err
			}

			// Secrets are set by the update data source function if the SecureJsonData is set in the command
			// Secrets are deleted by the update data source function if the disableSecretsCompatibility flag is enabled
			err = s.dataSourcesService.UpdateDataSource(ctx, &datasources.UpdateDataSourceCommand{
				Id:             ds.Id,
				OrgId:          ds.OrgId,
				Uid:            ds.Uid,
				Name:           ds.Name,
				JsonData:       ds.JsonData,
				SecureJsonData: secureJsonData,

				// These are needed by the SQL function due to UseBool and MustCols
				IsDefault:       ds.IsDefault,
				BasicAuth:       ds.BasicAuth,
				WithCredentials: ds.WithCredentials,
				ReadOnly:        ds.ReadOnly,
				User:            ds.User,
			})
			if err != nil {
				return err
			}
		}

		if disableSecretsCompatibility {
			s.kvStore.Set(ctx, 0, secretType, "secretMigrationStatus", "complete")
		} else {
			s.kvStore.Set(ctx, 0, secretType, "secretMigrationStatus", "compatible")
		}
	}

	return nil
}
