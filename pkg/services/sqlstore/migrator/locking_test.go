package migrator

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	_ "github.com/grafana/grafana/pkg/util/sqlite"
	"github.com/grafana/grafana/pkg/util/xorm"
)

func TestSupportsAdvisoryLocks(t *testing.T) {
	require.False(t, NewDialect(SQLite).SupportsAdvisoryLocks())
	require.True(t, NewDialect(Postgres).SupportsAdvisoryLocks())
	require.True(t, NewDialect(MySQL).SupportsAdvisoryLocks())
}

// TestRunMigrationsWithLockingSingleConnection is a regression test: on dialects
// without advisory locks (SQLite), enabling database locking used to pin the
// pool's only connection in an outer transaction while each migration waited
// forever for a second one.
func TestRunMigrationsWithLockingSingleConnection(t *testing.T) {
	engine, err := xorm.NewEngine("sqlite3", "file::memory:?cache=shared")
	require.NoError(t, err)
	t.Cleanup(func() { _ = engine.Close() })
	engine.SetMaxOpenConns(1)

	prev := connAcquireTimeout
	connAcquireTimeout = 2 * time.Second // fail instead of hanging if this regresses
	t.Cleanup(func() { connAcquireTimeout = prev })

	mg := NewMigrator(engine, nil)
	mg.AddCreateMigration()
	mg.AddMigration("create locking test table", NewAddTableMigration(Table{
		Name:    "migrator_locking_test",
		Columns: []*Column{{Name: "id", Type: DB_Int}},
	}))

	require.NoError(t, mg.RunMigrations(context.Background(), true, 0))
}

func TestInTransactionFailsFastWhenPoolExhausted(t *testing.T) {
	engine, err := xorm.NewEngine("sqlite3", "file::memory:?cache=shared")
	require.NoError(t, err)
	t.Cleanup(func() { _ = engine.Close() })
	engine.SetMaxOpenConns(1)

	prev := connAcquireTimeout
	connAcquireTimeout = 250 * time.Millisecond
	t.Cleanup(func() { connAcquireTimeout = prev })

	// Hold the pool's only connection in an open transaction.
	holder := engine.NewSession()
	require.NoError(t, holder.Begin())
	t.Cleanup(holder.Close)

	mg := NewMigrator(engine, nil)
	err = mg.InTransaction(func(sess *xorm.Session) error { return nil })
	require.ErrorContains(t, err, "waiting for a database connection")
}
