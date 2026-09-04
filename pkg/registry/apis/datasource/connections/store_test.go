package connections

import (
	"context"
	"testing"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestAsConnection(t *testing.T) {
	t.Run("maps a row onto the plugin's api group", func(t *testing.T) {
		conn, err := asConnection(connectionRow{UID: "abc", Name: "My Prom", Type: "prometheus"})
		require.NoError(t, err)
		assert.Equal(t, datasourceV0.DataSourceConnection{
			Title:      "My Prom",
			Name:       "abc",
			APIGroup:   "prometheus.datasource.grafana.app",
			APIVersion: "v0alpha1",
			Plugin:     "prometheus",
		}, conn)
	})

	t.Run("strips the grafana prefix and datasource suffix", func(t *testing.T) {
		conn, err := asConnection(connectionRow{UID: "x", Name: "Testdata", Type: "grafana-testdata-datasource"})
		require.NoError(t, err)
		assert.Equal(t, "testdata.datasource.grafana.app", conn.APIGroup)
	})

	t.Run("errors on a plugin id with no group mapping", func(t *testing.T) {
		_, err := asConnection(connectionRow{UID: "x", Name: "Odd", Type: "some-vendor-panel"})
		require.Error(t, err)
	})
}

func TestListConnectionsNamespace(t *testing.T) {
	store := NewLegacySQLStore(failingProvider(t), nil, nil)

	t.Run("rejects an unparseable namespace", func(t *testing.T) {
		_, err := store.ListConnections(context.Background(), datasourceV0.DataSourceConnectionQuery{Namespace: "org-0"})
		require.True(t, apierrors.IsBadRequest(err), "got %v", err)
	})

	t.Run("rejects a namespace with no org", func(t *testing.T) {
		_, err := store.ListConnections(context.Background(), datasourceV0.DataSourceConnectionQuery{Namespace: "unknown"})
		require.True(t, apierrors.IsBadRequest(err), "got %v", err)
	})

	t.Run("a missing stack is a 404, not a 500", func(t *testing.T) {
		notFound := func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
			return nil, legacysql.ErrNamespaceNotFound
		}
		s := NewLegacySQLStore(notFound, nil, nil)
		_, err := s.ListConnections(context.Background(), datasourceV0.DataSourceConnectionQuery{Namespace: "stacks-7"})
		require.True(t, apierrors.IsNotFound(err), "got %v", err)
	})
}

func TestIntegrationListConnections(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	insertDataSource(t, sqlStore, "data_source", 1001, 1, "prom-uid", "Prometheus", "prometheus")
	insertDataSource(t, sqlStore, "data_source", 1002, 1, "loki-uid", "Loki", "loki")
	insertDataSource(t, sqlStore, "data_source", 1003, 1, "td-uid", "Testdata", "grafana-testdata-datasource")
	// Another org must never leak into the default namespace
	insertDataSource(t, sqlStore, "data_source", 1004, 2, "other-uid", "Other org", "prometheus")

	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{OrgID: 1})
	store := NewLegacySQLStore(legacysql.NewDatabaseProvider(sqlStore), nil, nil)

	t.Run("returns every type in one call, scoped to the org", func(t *testing.T) {
		list, err := store.ListConnections(ctx, datasourceV0.DataSourceConnectionQuery{Namespace: "default"})
		require.NoError(t, err)

		assert.Equal(t, "DataSourceConnectionList", list.Kind)
		assert.Equal(t, "datasource.grafana.app/v0alpha1", list.APIVersion)
		assert.Equal(t, []string{"loki-uid", "prom-uid", "td-uid"}, uids(list))
	})

	t.Run("filters by plugin", func(t *testing.T) {
		list, err := store.ListConnections(ctx, datasourceV0.DataSourceConnectionQuery{Namespace: "default", Plugin: "loki"})
		require.NoError(t, err)
		assert.Equal(t, []string{"loki-uid"}, uids(list))
	})

	t.Run("filters by name", func(t *testing.T) {
		list, err := store.ListConnections(ctx, datasourceV0.DataSourceConnectionQuery{Namespace: "default", Name: "prom-uid"})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		assert.Equal(t, "Prometheus", list.Items[0].Title)
		assert.Equal(t, "prometheus.datasource.grafana.app", list.Items[0].APIGroup)
	})

	t.Run("an unknown name is a 404, not an empty list", func(t *testing.T) {
		_, err := store.ListConnections(ctx, datasourceV0.DataSourceConnectionQuery{Namespace: "default", Name: "nope"})
		require.True(t, apierrors.IsNotFound(err), "got %v", err)
	})

	t.Run("resolves plugin aliases when a resolver is supplied", func(t *testing.T) {
		aliased := NewLegacySQLStore(legacysql.NewDatabaseProvider(sqlStore), nil,
			func(context.Context, string) []string { return []string{"grafana-testdata-datasource"} })
		list, err := aliased.ListConnections(ctx, datasourceV0.DataSourceConnectionQuery{Namespace: "default", Plugin: "testdata"})
		require.NoError(t, err)
		assert.Equal(t, []string{"td-uid"}, uids(list))
	})

	t.Run("drops items the caller cannot read", func(t *testing.T) {
		filtered := NewLegacySQLStore(legacysql.NewDatabaseProvider(sqlStore), allowOnly("loki-uid"), nil)
		list, err := filtered.ListConnections(ctx, datasourceV0.DataSourceConnectionQuery{Namespace: "default"})
		require.NoError(t, err)
		assert.Equal(t, []string{"loki-uid"}, uids(list))
	})
}

// TestIntegrationTableIsResolvedThroughHelper proves no table reference bypasses
// LegacyDatabaseHelper.Table -- a literal would silently read the wrong tenant's
// schema in multi-tenant. The prefixed table holds different rows, so reading
// the unprefixed one would fail the assertion.
func TestIntegrationTableIsResolvedThroughHelper(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	createDataSourceTableCopy(t, sqlStore, "hg_tenant_data_source")
	insertDataSource(t, sqlStore, "data_source", 1005, 1, "unprefixed-uid", "Wrong table", "prometheus")
	insertDataSource(t, sqlStore, "hg_tenant_data_source", 1006, 1, "prefixed-uid", "Right table", "prometheus")

	prefixed := func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return &legacysql.LegacyDatabaseHelper{
			DB:    sqlStore,
			Table: func(n string) string { return "hg_tenant_" + n },
		}, nil
	}

	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{OrgID: 1})
	store := NewLegacySQLStore(prefixed, nil, nil)

	list, err := store.ListConnections(ctx, datasourceV0.DataSourceConnectionQuery{Namespace: "stacks-3"})
	require.NoError(t, err)
	assert.Equal(t, []string{"prefixed-uid"}, uids(list))
}

func uids(list *datasourceV0.DataSourceConnectionList) []string {
	out := make([]string, 0, len(list.Items))
	for _, item := range list.Items {
		out = append(out, item.Name)
	}
	return out
}

// failingProvider fails the test if it is ever called -- used by cases that must
// be rejected before any database access.
func failingProvider(t *testing.T) legacysql.LegacyDatabaseProvider {
	t.Helper()
	return func(context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		t.Fatal("database should not be reached")
		return nil, nil
	}
}

// insertDataSource sets an explicit id: TestIntegrationTableIsResolvedThroughHelper
// copies the table with CREATE TABLE ... AS SELECT, which carries the columns but
// not the identity sequence, so Postgres has nothing to generate an id from.
func insertDataSource(t *testing.T, sqlStore db.DB, table string, id, orgID int64, uid, name, dsType string) {
	t.Helper()
	err := sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := sess.Table(table).Insert(&datasources.DataSource{
			ID:      id,
			OrgID:   orgID,
			UID:     uid,
			Name:    name,
			Type:    dsType,
			Access:  datasources.DS_ACCESS_PROXY,
			Created: time.Now(),
			Updated: time.Now(),
		})
		return err
	})
	require.NoError(t, err)
}

func createDataSourceTableCopy(t *testing.T, sqlStore db.DB, name string) {
	t.Helper()
	exec := func(query string) error {
		return sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
			_, err := sess.Exec(query)
			return err
		})
	}

	// The Postgres test database outlives the test, so drop any copy a previous
	// run left behind and clean up after this one.
	require.NoError(t, exec("DROP TABLE IF EXISTS "+name))
	require.NoError(t, exec("CREATE TABLE "+name+" AS SELECT * FROM data_source WHERE 1=0"))
	t.Cleanup(func() { _ = exec("DROP TABLE IF EXISTS " + name) })
}

// allowOnly returns an access client whose compiled checker permits a single uid.
func allowOnly(uid string) authlib.AccessClient {
	return &fakeAccessClient{allowed: uid}
}

type fakeAccessClient struct {
	authlib.AccessClient
	allowed string
}

func (c *fakeAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return func(name, _ string) bool { return name == c.allowed }, nil, nil
}
