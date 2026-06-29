package annotation

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util/testutil/pgtest"
)

// newTestPostgresStore returns a PostgreSQL-backed Store
func newTestPostgresStore(t *testing.T) *PostgreSQLStore {
	t.Helper()
	dsn := pgtest.NewDatabase(t)

	cfg := PostgreSQLStoreConfig{
		ConnectionString: dsn,
		RetentionTTL:     200 * 365 * 24 * time.Hour,
	}

	store, err := NewPostgreSQLStore(t.Context(), cfg, nil)
	require.NoError(t, err, "create postgres store")
	t.Cleanup(func() { _ = store.Close() })

	return store
}
