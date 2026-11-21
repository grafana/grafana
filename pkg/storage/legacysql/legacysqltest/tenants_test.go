package legacysqltest

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationTenantsAreIsolated(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	store := db.NewTestStore(t)
	tenants := New(t, store, 2, "org")
	provider := tenants.Provider()

	insertOrg := func(h *legacysql.LegacyDatabaseHelper, name string) int64 {
		o := &org.Org{Name: name, Created: time.Now(), Updated: time.Now()}
		err := h.DB.WithDbSession(t.Context(), func(sess *db.Session) error {
			_, err := sess.Table(h.Table("org")).Insert(o)
			return err
		})
		require.NoError(t, err)
		return o.ID
	}
	orgNames := func(h *legacysql.LegacyDatabaseHelper) []string {
		var names []string
		err := h.DB.WithDbSession(t.Context(), func(sess *db.Session) error {
			return sess.SQL("SELECT name FROM " + h.QuotedTable("org") + " ORDER BY id").Find(&names)
		})
		require.NoError(t, err)
		return names
	}

	defaultHelper, err := legacysql.NewDatabaseProvider(store)(t.Context())
	require.NoError(t, err)
	insertOrg(defaultHelper, "decoy")

	for _, tenant := range tenants.Tenants {
		h, err := provider(tenant.Context(t.Context()))
		require.NoError(t, err)
		require.Equal(t, tenant.StackID, h.StackID)
		id := insertOrg(h, tenant.Namespace)
		if !db.IsTestDbPostgres() {
			// Each schema starts its own ids, so tenants reuse them. Postgres tables share the
			// source table's sequence instead.
			require.Equal(t, int64(1), id)
		}
	}

	for _, tenant := range tenants.Tenants {
		h, err := provider(tenant.Context(t.Context()))
		require.NoError(t, err)
		require.Equal(t, []string{tenant.Namespace}, orgNames(h))
	}
	require.Equal(t, []string{"decoy"}, orgNames(defaultHelper))

	t.Run("requires a known namespace", func(t *testing.T) {
		_, err := provider(t.Context())
		require.Error(t, err)

		_, err = provider(Tenant{Namespace: "stacks-1"}.Context(t.Context()))
		require.ErrorIs(t, err, legacysql.ErrNamespaceNotFound)
	})
}
