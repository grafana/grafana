package database

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/grafana/grafana/pkg/util/xorm/core"
)

var registerSecretsSQLMockXormDriverOnce sync.Once

type secretsSQLMockXormDriver struct{}

func (secretsSQLMockXormDriver) Parse(string, string) (*core.Uri, error) {
	return &core.Uri{DbType: core.SQLITE}, nil
}

type sqlmockSecretsDB struct {
	dbtest.FakeDB
	engine *xorm.Engine
}

func (d *sqlmockSecretsDB) WithDbSession(_ context.Context, callback sqlstore.DBTransactionFunc) error {
	sess := &sqlstore.DBSession{Session: d.engine.NewSession()}
	defer sess.Close()
	return callback(sess)
}

func (d *sqlmockSecretsDB) WithTransactionalDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error {
	return d.WithDbSession(ctx, callback)
}

func (d *sqlmockSecretsDB) GetDBType() core.DbType {
	return core.SQLITE
}

func (d *sqlmockSecretsDB) GetDialect() migrator.Dialect {
	return migrator.NewSQLite3Dialect()
}

func (d *sqlmockSecretsDB) Quote(value string) string {
	return d.engine.Quote(value)
}

type testKeyProvider struct{}

func (testKeyProvider) Encrypt(context.Context, []byte) ([]byte, error) {
	return []byte("encrypted"), nil
}

func (testKeyProvider) Decrypt(context.Context, []byte) ([]byte, error) {
	return []byte("decrypted"), nil
}

func newDataKeyRows() *sqlmock.Rows {
	now := time.Now()
	return sqlmock.NewRows([]string{
		"active",
		"name",
		"label",
		"scope",
		"provider",
		"encrypted_data",
		"created",
		"updated",
	}).AddRow(true, "data-key", "key-label", "root", "test.v1", []byte("ciphertext"), now, now)
}

func TestStoreUsesProviderTables(t *testing.T) {
	registerSecretsSQLMockXormDriverOnce.Do(func() {
		if core.QueryDriver("sqlmock") == nil {
			core.RegisterDriver("sqlmock", secretsSQLMockXormDriver{})
		}
	})

	dsn := "secrets-database-store"
	mockDB, mock, err := sqlmock.NewWithDSN(dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = mockDB.Close() })

	engine, err := xorm.NewEngine("sqlmock", dsn)
	require.NoError(t, err)
	t.Cleanup(func() { _ = engine.Close() })

	legacyDB := &sqlmockSecretsDB{engine: engine}
	type contextKey struct{}
	ctx := context.WithValue(context.Background(), contextKey{}, "provider context")
	providerCalls := 0
	resolvedTables := make([]string, 0)
	provider := func(gotCtx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		require.Equal(t, "provider context", gotCtx.Value(contextKey{}))
		providerCalls++
		return &legacysql.LegacyDatabaseHelper{
			DB: legacyDB,
			Table: func(name string) string {
				resolvedTables = append(resolvedTables, name)
				return "test_schema." + name
			},
		}, nil
	}
	store := ProvideSecretsStore(provider)

	mock.ExpectQuery(`(?s).*FROM .*test_schema.*data_keys.*`).WillReturnRows(newDataKeyRows())
	_, err = store.GetDataKey(ctx, "data-key")
	require.NoError(t, err)

	mock.ExpectQuery(`(?s).*FROM .*test_schema.*data_keys.*`).WillReturnRows(newDataKeyRows())
	_, err = store.GetCurrentDataKey(ctx, "key-label")
	require.NoError(t, err)

	mock.ExpectQuery(`(?s).*FROM .*test_schema.*data_keys.*`).WillReturnRows(newDataKeyRows())
	keys, err := store.GetAllDataKeys(ctx)
	require.NoError(t, err)
	require.Len(t, keys, 1)

	mock.ExpectExec(`(?s)INSERT INTO .*test_schema.*data_keys.*`).WillReturnResult(sqlmock.NewResult(0, 1))
	err = store.CreateDataKey(ctx, &secrets.DataKey{
		Id:            "created-key",
		Label:         "created-label",
		Active:        true,
		Provider:      "test.v1",
		EncryptedData: []byte("ciphertext"),
	})
	require.NoError(t, err)

	mock.ExpectExec(`(?s)UPDATE .*test_schema.*data_keys.*`).WillReturnResult(sqlmock.NewResult(0, 1))
	err = store.DisableDataKeys(ctx)
	require.NoError(t, err)

	mock.ExpectExec(`(?s)DELETE FROM .*test_schema.*data_keys.*`).WillReturnResult(sqlmock.NewResult(0, 1))
	err = store.DeleteDataKey(ctx, "data-key")
	require.NoError(t, err)

	mock.ExpectQuery(`(?s).*FROM .*test_schema.*data_keys.*`).WillReturnRows(newDataKeyRows())
	mock.ExpectExec(`(?s)UPDATE .*test_schema.*data_keys.*`).WillReturnResult(sqlmock.NewResult(0, 1))
	err = store.ReEncryptDataKeys(ctx, map[secrets.ProviderID]secrets.Provider{
		"test.v1": testKeyProvider{},
	}, "test.v1")
	require.NoError(t, err)

	require.Equal(t, 7, providerCalls)
	require.Len(t, resolvedTables, 8)
	for _, table := range resolvedTables {
		require.Equal(t, "data_keys", table)
	}
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestStoreReturnsProviderErrorBeforeDatabaseAccess(t *testing.T) {
	providerErr := errors.New("provider unavailable")
	store := ProvideSecretsStore(func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return nil, providerErr
	})

	_, err := store.GetAllDataKeys(context.Background())
	require.ErrorIs(t, err, providerErr)
}
