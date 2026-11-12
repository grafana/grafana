package service

import (
	"context"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/manager/pluginfakes"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsmng "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// txCountingDB counts the transactions opened on the wrapped database.
type txCountingDB struct {
	db.DB
	transactions atomic.Int32
}

func (d *txCountingDB) InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	d.transactions.Add(1)
	return d.DB.InTransaction(ctx, fn)
}

// TestIntegrationServiceTransactionsUseProvidedDatabase asserts the outer transaction of
// Add/Update/DeleteDataSource is opened on the database from the LegacyDatabaseProvider. The
// store reuses whatever session is on the context without checking which engine created it,
// so a transaction opened on any other database would run the tenant-prefixed queries there.
func TestIntegrationServiceTransactionsUseProvidedDatabase(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const (
		tenantTable        = "tenant_data_source"
		tenantSecretsTable = "tenant_secrets"
	)
	tenant := &txCountingDB{DB: db.NewTestStore(t)}
	other := &txCountingDB{DB: db.NewTestStore(t)}

	ctx := context.Background()
	require.NoError(t, tenant.WithDbSession(ctx, func(sess *db.Session) error {
		if err := sess.Table(tenantTable).CreateTable(&datasources.DataSource{}); err != nil {
			return err
		}
		return sess.Table(tenantSecretsTable).CreateTable(&secretskvs.Item{})
	}))

	// countSecrets reports the rows in a secrets table on the tenant database. The unprefixed
	// "secrets" table exists there too, from the test store's migrations, so a store that
	// skipped the provider's table locator would silently write to it instead.
	countSecrets := func(t *testing.T, table string) int64 {
		t.Helper()
		var count int64
		require.NoError(t, tenant.WithDbSession(ctx, func(sess *db.Session) error {
			var err error
			count, err = sess.Table(table).Count(&secretskvs.Item{})
			return err
		}))
		return count
	}

	provider := func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return &legacysql.LegacyDatabaseHelper{
			DB:    tenant,
			Table: func(n string) string { return "tenant_" + n },
		}, nil
	}

	secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	secretsStore := secretskvs.NewSQLSecretsKVStore(provider, secretsService, log.New("test.logger"))
	permissions := acmock.NewMockedPermissionsService()
	permissions.On("DeleteResourcePermissions", mock.Anything, mock.Anything, mock.Anything).Return(nil)

	// The db.DB argument is deliberately a different database from the provider's.
	svc, err := ProvideService(other, provider, secretsService, secretsStore, &setting.Cfg{},
		featuremgmt.WithFeatures(), actest.FakeAccessControl{}, permissions, quotatest.New(false, nil),
		&pluginstore.FakePluginStore{}, &pluginfakes.FakePluginClient{}, nil, ProvideDataSourceRetriever(provider))
	require.NoError(t, err)

	ds, err := svc.AddDataSource(ctx, &datasources.AddDataSourceCommand{OrgID: 1, Name: "ds", Type: "prometheus",
		SecureJsonData: map[string]string{"password": "secret"}})
	require.NoError(t, err)
	require.Equal(t, int32(1), tenant.transactions.Load())
	require.EqualValues(t, 1, countSecrets(t, tenantSecretsTable))

	_, err = svc.UpdateDataSource(ctx, &datasources.UpdateDataSourceCommand{ID: ds.ID, OrgID: 1, Name: "renamed", Type: "prometheus"}) //nolint:staticcheck // Preserve legacy field compatibility.
	require.NoError(t, err)
	require.Equal(t, int32(2), tenant.transactions.Load())
	// The rename moves the row rather than adding one.
	require.EqualValues(t, 1, countSecrets(t, tenantSecretsTable))

	require.NoError(t, svc.DeleteDataSource(ctx, &datasources.DeleteDataSourceCommand{UID: ds.UID, OrgID: 1, Name: "renamed"}))
	require.Equal(t, int32(3), tenant.transactions.Load())
	require.EqualValues(t, 0, countSecrets(t, tenantSecretsTable))

	require.Zero(t, other.transactions.Load())
	require.EqualValues(t, 0, countSecrets(t, "secrets"))
}
