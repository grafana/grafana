package migrations

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
)

const (
	// Not set means migration has not happened
	secretMigrationStatusKey = "secretMigrationStatus"
	// Migration happened and secrets are stored in both locations
	compatibleSecretMigrationValue = "compatible"
)

type DataSourceSecretMigrationService struct {
	dataSourcesService datasources.DataSourceService
	kvStore            *kvstore.NamespacedKVStore
	features           featuremgmt.FeatureToggles
}

func ProvideDataSourceMigrationService(
	dataSourcesService datasources.DataSourceService,
	kvStore kvstore.KVStore,
	features featuremgmt.FeatureToggles,
) *DataSourceSecretMigrationService {
	return &DataSourceSecretMigrationService{
		dataSourcesService: dataSourcesService,
		kvStore:            kvstore.WithNamespace(kvStore, 0, secretskvs.DataSourceSecretType),
		features:           features,
	}
}

func (s *DataSourceSecretMigrationService) Migrate(ctx context.Context) error {
	migrationStatus, _, err := s.kvStore.Get(ctx, secretMigrationStatusKey)
	if err != nil {
		return err
	}
	logger.Debug(fmt.Sprint("secret migration status is ", migrationStatus))

	// Only migrate if it hasn't happened yet
	if migrationStatus != compatibleSecretMigrationValue {
		logger.Debug("performing secret migration")
		query := &datasources.GetAllDataSourcesQuery{}
		dsList, err := s.dataSourcesService.GetAllDataSources(ctx, query)
		if err != nil {
			return err
		}

		for _, ds := range dsList {
			secureJsonData, err := s.dataSourcesService.DecryptedValues(ctx, ds)
			if err != nil {
				return err
			}

			// Secrets are set by the update data source function if the SecureJsonData is set in the command
			_, err = s.dataSourcesService.UpdateDataSource(ctx, &datasources.UpdateDataSourceCommand{
				ID:             ds.ID,
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

		err = s.kvStore.Set(ctx, secretMigrationStatusKey, compatibleSecretMigrationValue)
		if err != nil {
			return err
		}
		logger.Debug(fmt.Sprint("set secret migration status to ", compatibleSecretMigrationValue))
	}

	return nil
}
