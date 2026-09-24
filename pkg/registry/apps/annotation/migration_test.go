package annotation

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pressly/goose/v3"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util/testutil/pgtest"
)

func newMigrationTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := pgtest.NewDatabase(t)

	pool, err := pgxpool.New(t.Context(), dsn)
	require.NoError(t, err, "connect to test database")
	t.Cleanup(pool.Close)

	return pool
}

func runMigrationsUpTo(t *testing.T, ctx context.Context, pool *pgxpool.Pool, version int64) {
	t.Helper()
	provider, db, err := newMigrationProvider(pool)
	require.NoError(t, err)
	defer func() { require.NoError(t, db.Close()) }()

	_, err = provider.UpTo(ctx, version)
	require.NoError(t, err, "run migrations up to version %d", version)
}

func TestIntegrationMigrations(t *testing.T) {
	t.Run("00009_backfill_time_end", func(t *testing.T) {
		pool := newMigrationTestPool(t)
		ctx := t.Context()

		// Run up to 00008, which creates the annotations table with time_end NULLable.
		runMigrationsUpTo(t, ctx, pool, 8)

		const namespace = "stacks-migration-test"
		seedRow := func(name string, ts int64, timeEnd any) {
			require.NoError(t, ensurePartition(ctx, pool, ts))
			_, err := pool.Exec(ctx,
				`INSERT INTO annotations (namespace, name, time, time_end, text, created_at)
				 VALUES ($1, $2, $3, $4, 'seed', $5)`,
				namespace, name, ts, timeEnd, time.UnixMilli(ts).UTC())
			require.NoError(t, err, "seed row %q", name)
		}

		// A point annotation predating the NOT NULL constraint
		seedRow("legacy-point", 1_000, nil)
		// A range annotation with an existing time_end
		seedRow("legacy-range", 2_000, int64(2_500))

		// Run the 00009 backfill migration
		runMigrationsUpTo(t, ctx, pool, 9)

		var remainingNulls int
		require.NoError(t, pool.QueryRow(ctx,
			`SELECT count(*) FROM annotations WHERE time_end IS NULL`).Scan(&remainingNulls))
		require.Zero(t, remainingNulls, "00009 must backfill every NULL time_end")

		var pointTimeEnd, rangeTimeEnd int64
		require.NoError(t, pool.QueryRow(ctx,
			`SELECT time_end FROM annotations WHERE namespace = $1 AND name = 'legacy-point'`, namespace).Scan(&pointTimeEnd))
		require.Equal(t, int64(1_000), pointTimeEnd, "a point's time_end is backfilled to its own time")

		require.NoError(t, pool.QueryRow(ctx,
			`SELECT time_end FROM annotations WHERE namespace = $1 AND name = 'legacy-range'`, namespace).Scan(&rangeTimeEnd))
		require.Equal(t, int64(2_500), rangeTimeEnd, "a range's existing time_end is left untouched")

		// Validate that the remaining migrations apply cleanly on top of the backfilled data
		runMigrationsUpTo(t, ctx, pool, goose.MaxVersion)
	})
}
