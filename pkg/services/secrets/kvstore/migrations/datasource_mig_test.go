package migrations

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsservice "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsmng "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
)

func SetupTestDataSourceSecretMigrationService(t *testing.T, sqlStore db.DB, kvStore kvstore.KVStore, secretsStore secretskvs.SecretsKVStore, compatibility bool) *DataSourceSecretMigrationService {
	t.Helper()
	cfg := &setting.Cfg{}
	features := featuremgmt.WithFeatures()
	if !compatibility {
		features = featuremgmt.WithFeatures(featuremgmt.FlagDisableSecretsCompatibility, true)
	}
	secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	quotaService := quotatest.New(false, nil)
	dsService, err := dsservice.ProvideService(sqlStore, secretsService, secretsStore, cfg, features, acmock.New().WithDisabled(), acmock.NewMockedPermissionsService(), quotaService)
	require.NoError(t, err)
	migService := ProvideDataSourceMigrationService(dsService, kvStore, features)
	return migService
}

func TestMigrate(t *testing.T) {
	t.Run("should migrate from legacy to unified without compatibility", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		kvStore := kvstore.ProvideService(sqlStore)
		secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
		secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
		migService := SetupTestDataSourceSecretMigrationService(t, sqlStore, kvStore, secretsStore, false)
		ds := dsservice.CreateStore(sqlStore, log.NewNopLogger())
		dataSourceName := "Test"
		dataSourceOrg := int64(1)
		_, err := ds.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
			OrgID:  dataSourceOrg,
			Name:   dataSourceName,
			Type:   datasources.DS_MYSQL,
			Access: datasources.DS_ACCESS_DIRECT,
			URL:    "http://test",
			EncryptedSecureJsonData: map[string][]byte{
				"password": []byte("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"),
			},
		})
		assert.NoError(t, err)

		// Check if the secret json data was added
		query := &datasources.GetDataSourceQuery{OrgID: dataSourceOrg, Name: dataSourceName}
		dataSource, err := ds.GetDataSource(context.Background(), query)
		assert.NoError(t, err)
		assert.NotNil(t, dataSource)
		assert.NotEmpty(t, dataSource.SecureJsonData)

		// Check if the migration status key is empty
		value, exist, err := kvStore.Get(context.Background(), 0, secretskvs.DataSourceSecretType, secretMigrationStatusKey)
		assert.NoError(t, err)
		assert.Empty(t, value)
		assert.False(t, exist)

		// Check that the secret is not present on the secret store
		value, exist, err = secretsStore.Get(context.Background(), dataSourceOrg, dataSourceName, secretskvs.DataSourceSecretType)
		assert.NoError(t, err)
		assert.Empty(t, value)
		assert.False(t, exist)

		// Run the migration
		err = migService.Migrate(context.Background())
		assert.NoError(t, err)

		// Check if the secure json data was deleted
		query = &datasources.GetDataSourceQuery{OrgID: dataSourceOrg, Name: dataSourceName}
		dataSource, err = ds.GetDataSource(context.Background(), query)
		assert.NoError(t, err)
		assert.NotNil(t, dataSource)
		assert.Empty(t, dataSource.SecureJsonData)

		// Check if the secret was added to the secret store
		value, exist, err = secretsStore.Get(context.Background(), dataSourceOrg, dataSourceName, secretskvs.DataSourceSecretType)
		assert.NoError(t, err)
		assert.NotEmpty(t, value)
		assert.True(t, exist)

		// Check if the migration status key was set
		value, exist, err = kvStore.Get(context.Background(), 0, secretskvs.DataSourceSecretType, secretMigrationStatusKey)
		assert.NoError(t, err)
		assert.Equal(t, completeSecretMigrationValue, value)
		assert.True(t, exist)
	})

	t.Run("should migrate from legacy to unified with compatibility", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		kvStore := kvstore.ProvideService(sqlStore)
		secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
		secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
		migService := SetupTestDataSourceSecretMigrationService(t, sqlStore, kvStore, secretsStore, true)
		ds := dsservice.CreateStore(sqlStore, log.NewNopLogger())
		dataSourceName := "Test"
		dataSourceOrg := int64(1)

		// Add test data source
		_, err := ds.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
			OrgID:  dataSourceOrg,
			Name:   dataSourceName,
			Type:   datasources.DS_MYSQL,
			Access: datasources.DS_ACCESS_DIRECT,
			URL:    "http://test",
			EncryptedSecureJsonData: map[string][]byte{
				"password": []byte("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"),
			},
		})
		assert.NoError(t, err)

		// Check if the secret json data was added
		query := &datasources.GetDataSourceQuery{OrgID: dataSourceOrg, Name: dataSourceName}
		dataSource, err := ds.GetDataSource(context.Background(), query)
		assert.NoError(t, err)
		assert.NotNil(t, dataSource)
		assert.NotEmpty(t, dataSource.SecureJsonData)

		// Check if the migration status key is empty
		value, exist, err := kvStore.Get(context.Background(), 0, secretskvs.DataSourceSecretType, secretMigrationStatusKey)
		assert.NoError(t, err)
		assert.Empty(t, value)
		assert.False(t, exist)

		// Check that the secret is not present on the secret store
		value, exist, err = secretsStore.Get(context.Background(), dataSourceOrg, dataSourceName, secretskvs.DataSourceSecretType)
		assert.NoError(t, err)
		assert.Empty(t, value)
		assert.False(t, exist)

		// Run the migration
		err = migService.Migrate(context.Background())
		assert.NoError(t, err)

		// Check if the secure json data was maintained for compatibility
		query = &datasources.GetDataSourceQuery{OrgID: dataSourceOrg, Name: dataSourceName}
		dataSource, err = ds.GetDataSource(context.Background(), query)
		assert.NoError(t, err)
		assert.NotNil(t, dataSource)
		assert.NotEmpty(t, dataSource.SecureJsonData)

		// Check if the secret was added to the secret store
		value, exist, err = secretsStore.Get(context.Background(), dataSourceOrg, dataSourceName, secretskvs.DataSourceSecretType)
		assert.NoError(t, err)
		assert.NotEmpty(t, value)
		assert.True(t, exist)

		// Check if the migration status key was set
		value, exist, err = kvStore.Get(context.Background(), 0, secretskvs.DataSourceSecretType, secretMigrationStatusKey)
		assert.NoError(t, err)
		assert.Equal(t, compatibleSecretMigrationValue, value)
		assert.True(t, exist)
	})

	t.Run("should replicate from unified to legacy for compatibility", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)

		kvStore := kvstore.ProvideService(sqlStore)
		secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
		secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
		migService := SetupTestDataSourceSecretMigrationService(t, sqlStore, kvStore, secretsStore, false)
		ds := dsservice.CreateStore(sqlStore, log.NewNopLogger())

		dataSourceName := "Test"
		dataSourceOrg := int64(1)

		// Add test data source
		_, err := ds.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
			OrgID:  dataSourceOrg,
			Name:   dataSourceName,
			Type:   datasources.DS_MYSQL,
			Access: datasources.DS_ACCESS_DIRECT,
			URL:    "http://test",
			EncryptedSecureJsonData: map[string][]byte{
				"password": []byte("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"),
			},
		})
		assert.NoError(t, err)

		// Check if the secret json data was added
		query := &datasources.GetDataSourceQuery{OrgID: dataSourceOrg, Name: dataSourceName}
		dataSource, err := ds.GetDataSource(context.Background(), query)
		assert.NoError(t, err)
		assert.NotNil(t, dataSource)
		assert.NotEmpty(t, dataSource.SecureJsonData)

		// Check if the migration status key is empty
		value, exist, err := kvStore.Get(context.Background(), 0, secretskvs.DataSourceSecretType, secretMigrationStatusKey)
		assert.NoError(t, err)
		assert.Empty(t, value)
		assert.False(t, exist)

		// Check that the secret is not present on the secret store
		value, exist, err = secretsStore.Get(context.Background(), dataSourceOrg, dataSourceName, secretskvs.DataSourceSecretType)
		assert.NoError(t, err)
		assert.Empty(t, value)
		assert.False(t, exist)

		// Run the migration without compatibility
		err = migService.Migrate(context.Background())
		assert.NoError(t, err)

		// Check if the secure json data was deleted
		query = &datasources.GetDataSourceQuery{OrgID: dataSourceOrg, Name: dataSourceName}
		dataSource, err = ds.GetDataSource(context.Background(), query)
		assert.NoError(t, err)
		assert.NotNil(t, dataSource)
		assert.Empty(t, dataSource.SecureJsonData)

		// Check if the secret was added to the secret store
		value, exist, err = secretsStore.Get(context.Background(), dataSourceOrg, dataSourceName, secretskvs.DataSourceSecretType)
		assert.NoError(t, err)
		assert.NotEmpty(t, value)
		assert.True(t, exist)

		// Check if the migration status key was set
		value, exist, err = kvStore.Get(context.Background(), 0, secretskvs.DataSourceSecretType, secretMigrationStatusKey)
		assert.NoError(t, err)
		assert.Equal(t, completeSecretMigrationValue, value)
		assert.True(t, exist)

		// Run the migration with compatibility
		migService = SetupTestDataSourceSecretMigrationService(t, sqlStore, kvStore, secretsStore, true)
		err = migService.Migrate(context.Background())
		assert.NoError(t, err)

		// Check if the secure json data was re-added for compatibility
		query = &datasources.GetDataSourceQuery{OrgID: dataSourceOrg, Name: dataSourceName}
		dataSource, err = ds.GetDataSource(context.Background(), query)
		assert.NoError(t, err)
		assert.NotNil(t, dataSource)
		assert.NotEmpty(t, dataSource.SecureJsonData)

		// Check if the secret was added to the secret store
		value, exist, err = secretsStore.Get(context.Background(), dataSourceOrg, dataSourceName, secretskvs.DataSourceSecretType)
		assert.NoError(t, err)
		assert.NotEmpty(t, value)
		assert.True(t, exist)

		// Check if the migration status key was set
		value, exist, err = kvStore.Get(context.Background(), 0, secretskvs.DataSourceSecretType, secretMigrationStatusKey)
		assert.NoError(t, err)
		assert.Equal(t, compatibleSecretMigrationValue, value)
		assert.True(t, exist)
	})

	t.Run("should delete from legacy to remove compatibility", func(t *testing.T) {
		sqlStore := db.InitTestDB(t)
		kvStore := kvstore.ProvideService(sqlStore)
		secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
		secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
		migService := SetupTestDataSourceSecretMigrationService(t, sqlStore, kvStore, secretsStore, true)
		ds := dsservice.CreateStore(sqlStore, log.NewNopLogger())

		dataSourceName := "Test"
		dataSourceOrg := int64(1)

		// Add test data source
		_, err := ds.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
			OrgID:  dataSourceOrg,
			Name:   dataSourceName,
			Type:   datasources.DS_MYSQL,
			Access: datasources.DS_ACCESS_DIRECT,
			URL:    "http://test",
			EncryptedSecureJsonData: map[string][]byte{
				"password": []byte("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"),
			},
		})
		assert.NoError(t, err)

		// Check if the secret json data was added
		query := &datasources.GetDataSourceQuery{OrgID: dataSourceOrg, Name: dataSourceName}
		dataSource, err := ds.GetDataSource(context.Background(), query)
		assert.NoError(t, err)
		assert.NotNil(t, dataSource)
		assert.NotEmpty(t, dataSource.SecureJsonData)

		// Check if the migration status key is empty
		value, exist, err := kvStore.Get(context.Background(), 0, secretskvs.DataSourceSecretType, secretMigrationStatusKey)
		assert.NoError(t, err)
		assert.Empty(t, value)
		assert.False(t, exist)

		// Check that the secret is not present on the secret store
		value, exist, err = secretsStore.Get(context.Background(), dataSourceOrg, dataSourceName, secretskvs.DataSourceSecretType)
		assert.NoError(t, err)
		assert.Empty(t, value)
		assert.False(t, exist)

		// Run the migration with compatibility
		err = migService.Migrate(context.Background())
		assert.NoError(t, err)

		// Check if the secure json data was maintained for compatibility
		query = &datasources.GetDataSourceQuery{OrgID: dataSourceOrg, Name: dataSourceName}
		dataSource, err = ds.GetDataSource(context.Background(), query)
		assert.NoError(t, err)
		assert.NotNil(t, dataSource)
		assert.NotEmpty(t, dataSource.SecureJsonData)

		// Check if the secret was added to the secret store
		value, exist, err = secretsStore.Get(context.Background(), dataSourceOrg, dataSourceName, secretskvs.DataSourceSecretType)
		assert.NoError(t, err)
		assert.NotEmpty(t, value)
		assert.True(t, exist)

		// Check if the migration status key was set
		value, exist, err = kvStore.Get(context.Background(), 0, secretskvs.DataSourceSecretType, secretMigrationStatusKey)
		assert.NoError(t, err)
		assert.Equal(t, compatibleSecretMigrationValue, value)
		assert.True(t, exist)

		// Run the migration without compatibility
		migService = SetupTestDataSourceSecretMigrationService(t, sqlStore, kvStore, secretsStore, false)
		err = migService.Migrate(context.Background())
		assert.NoError(t, err)

		// Check if the secure json data was deleted
		query = &datasources.GetDataSourceQuery{OrgID: dataSourceOrg, Name: dataSourceName}
		dataSource, err = ds.GetDataSource(context.Background(), query)
		assert.NoError(t, err)
		assert.NotNil(t, dataSource)
		assert.Empty(t, dataSource.SecureJsonData)

		// Check if the secret was added to the secret store
		value, exist, err = secretsStore.Get(context.Background(), dataSourceOrg, dataSourceName, secretskvs.DataSourceSecretType)
		assert.NoError(t, err)
		assert.NotEmpty(t, value)
		assert.True(t, exist)

		// Check if the migration status key was set
		value, exist, err = kvStore.Get(context.Background(), 0, secretskvs.DataSourceSecretType, secretMigrationStatusKey)
		assert.NoError(t, err)
		assert.Equal(t, completeSecretMigrationValue, value)
		assert.True(t, exist)
	})
}
