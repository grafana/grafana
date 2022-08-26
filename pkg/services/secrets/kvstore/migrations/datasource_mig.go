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
	// Migration happened with disableSecretCompatibility set to false
	compatibleSecretMigrationValue = "compatible"
	// Migration happened with disableSecretCompatibility set to true
	completeSecretMigrationValue = "complete"
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
	// If this flag is true, delete secrets from the legacy secrets store as they are migrated
	disableSecretsCompatibility := s.features.IsEnabled(featuremgmt.FlagDisableSecretsCompatibility)
	// If migration hasn't happened, migrate to unified secrets and keep copy in legacy
	// If a complete migration happened and now backwards compatibility is enabled, copy secrets back to legacy
	needCompatibility := migrationStatus != compatibleSecretMigrationValue && !disableSecretsCompatibility
	// If migration hasn't happened, migrate to unified secrets and delete from legacy
	// If a compatible migration happened and now compatibility is disabled, delete secrets from legacy
	needMigration := migrationStatus != completeSecretMigrationValue && disableSecretsCompatibility

	if needCompatibility || needMigration {
		logger.Debug("performing secret migration", "needs migration", needMigration, "needs compatibility", needCompatibility)
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

		var newMigStatus string
		if disableSecretsCompatibility {
			newMigStatus = completeSecretMigrationValue
		} else {
			newMigStatus = compatibleSecretMigrationValue
		}
		err = s.kvStore.Set(ctx, secretMigrationStatusKey, newMigStatus)
		if err != nil {
			return err
		}
		logger.Debug(fmt.Sprint("set secret migration status to ", newMigStatus))
	}

	return nil
}
