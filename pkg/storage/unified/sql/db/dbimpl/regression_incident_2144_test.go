package dbimpl

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// defined in the standard library in database/sql/ctxutil.go
const noIsolationLevelSupportErrStr = "sql: driver does not support non-" +
	"default isolation level"

func TestReproIncident2144IndependentOfGrafanaDB(t *testing.T) {
	t.Parallel()
	registerTestSQLDrivers()
	txOpts := &sql.TxOptions{
		Isolation: sql.LevelSerializable,
	}

	t.Run("driver without isolation level should fail", func(t *testing.T) {
		t.Parallel()
		ctx := testutil.NewDefaultTestContext(t)

		db, err := sql.Open(driverWithoutIsolationLevelName, "")
		require.NoError(t, err)
		require.NotNil(t, db)

		_, err = db.BeginTx(ctx, txOpts)
		require.Error(t, err)
		require.Equal(t, noIsolationLevelSupportErrStr, err.Error())
	})

	t.Run("driver with isolation level should work", func(t *testing.T) {
		t.Parallel()
		ctx := testutil.NewDefaultTestContext(t)

		db, err := sql.Open(driverWithIsolationLevelName, "")
		require.NoError(t, err)
		require.NotNil(t, db)

		_, err = db.BeginTx(ctx, txOpts)
		require.NoError(t, err)
	})
}

func TestReproIncident2144UsingGrafanaDB(t *testing.T) {
	t.Parallel()
	txOpts := &sql.TxOptions{
		Isolation: sql.LevelSerializable,
	}

	t.Run("core Grafana db without instrumentation preserves driver ability to use isolation levels",
		func(t *testing.T) {
			t.Parallel()

			t.Run("base behaviour is preserved", func(t *testing.T) {
				t.Parallel()
				ctx := testutil.NewDefaultTestContext(t)
				cfgMap := cfgMap{}
				setupDBForGrafana(t, ctx, cfgMap)
				grafanaDB := newTestInfraDB(t, cfgMap)
				db := grafanaDB.GetEngine().DB().DB
				_, err := db.BeginTx(ctx, txOpts)
				require.NoError(t, err)
			})

			t.Run("Resource API does not fail and correctly uses Grafana DB as fallback",
				func(t *testing.T) {
					t.Parallel()
					ctx := testutil.NewDefaultTestContext(t)
					cfgMap := cfgMap{}
					cfg := newCfgFromIniMap(t, cfgMap)
					setupDBForGrafana(t, ctx, cfgMap)
					grafanaDB := newTestInfraDB(t, cfgMap)
					resourceDB, err := ProvideResourceDB(grafanaDB, setting.ProvideService(cfg), nil)
					require.NotNil(t, resourceDB)
					require.NoError(t, err)
				})
		})

	t.Run("core Grafana db instrumentation removes driver ability to use isolation levels",
		func(t *testing.T) {
			t.Parallel()
			ctx := testutil.NewDefaultTestContext(t)
			cfgMap := cfgMap{
				"database": cfgSectionMap{
					grafanaDBInstrumentQueriesKey: "true",
				},
			}
			setupDBForGrafana(t, ctx, cfgMap)
			grafanaDB := newTestInfraDB(t, cfgMap)

			t.Run("base failure caused by instrumentation", func(t *testing.T) {
				t.Parallel()
				ctx := testutil.NewDefaultTestContext(t)
				db := grafanaDB.GetEngine().DB().DB
				_, err := db.BeginTx(ctx, txOpts)
				require.Error(t, err)
				require.Equal(t, noIsolationLevelSupportErrStr, err.Error())
			})

			t.Run("Resource API provides a reasonable error for this case", func(t *testing.T) {
				t.Parallel()
				cfg := setting.NewCfg()
				cfg.SectionWithEnvOverrides("database").Key(grafanaDBInstrumentQueriesKey).SetValue("true")
				resourceDB, err := ProvideResourceDB(grafanaDB, setting.ProvideService(cfg), nil)
				require.Nil(t, resourceDB)
				require.Error(t, err)
				require.ErrorIs(t, err, errGrafanaDBInstrumentedNotSupported)
			})
		})
}
