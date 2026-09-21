package errortracking

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgreSQLStore(t *testing.T) {
	connectionString := os.Getenv("ERROR_TRACKING_TEST_DATABASE_URL")
	if connectionString == "" {
		t.Skip("set ERROR_TRACKING_TEST_DATABASE_URL to run the PostgreSQL integration test")
	}

	cfg := setting.NewCfg()
	cfg.Raw.Section("grafana-apiserver").Key("runtime_config").SetValue("error-tracking.grafana.app/v0alpha1=true")
	cfg.Raw.Section("error_tracking").Key("database_url").SetValue(connectionString)
	store, err := ProvideStore(cfg)
	require.NoError(t, err)
	t.Cleanup(store.Close)

	ctx := context.Background()
	testID := fmt.Sprintf("test-%d", time.Now().UnixNano())
	tenantAlice := testID + "-org-1"
	tenantBob := testID + "-org-2"
	require.NoError(t, store.InsertEvent(ctx, tenantAlice, "user:alice", "10.0.0.1", "infra", "database unavailable", 0))
	require.NoError(t, store.InsertEvent(ctx, tenantBob, "user:bob", "10.0.0.2", "infra", "database unavailable", 0))

	events, err := store.ListEvents(ctx, tenantAlice, time.Now().Add(-time.Hour), time.Now().Add(time.Hour), 100)
	require.NoError(t, err)
	require.Len(t, events, 1)
	require.Equal(t, "database unavailable", events[0].Message)

	events, err = store.ListEvents(ctx, tenantBob, time.Now().Add(-time.Hour), time.Now().Add(time.Hour), 100)
	require.NoError(t, err)
	require.Len(t, events, 1)
	require.Equal(t, "database unavailable", events[0].Message)
}

func TestNewStoreInvalidConfigurationDoesNotLeakCredentials(t *testing.T) {
	const connectionString = "postgres://error_tracking:secret-password@%zz"

	_, err := NewStore(connectionString, defaultMaxConns)
	require.Error(t, err)
	require.NotContains(t, err.Error(), "secret-password")
}

func TestPostgreSQLConfigUsesEnvironmentCredentials(t *testing.T) {
	t.Setenv("PGHOST", "error-tracking-postgres")
	t.Setenv("PGPORT", "5432")
	t.Setenv("PGUSER", "error_tracking_app")
	t.Setenv("PGPASSWORD", "p@ss word#with=chars")
	t.Setenv("PGDATABASE", "error_tracking")

	config, err := pgxpool.ParseConfig("sslmode=disable")
	require.NoError(t, err)
	require.Equal(t, "error-tracking-postgres", config.ConnConfig.Host)
	require.Equal(t, uint16(5432), config.ConnConfig.Port)
	require.Equal(t, "error_tracking_app", config.ConnConfig.User)
	require.Equal(t, "p@ss word#with=chars", config.ConnConfig.Password)
	require.Equal(t, "error_tracking", config.ConnConfig.Database)
}

func TestConfiguredMaxConns(t *testing.T) {
	for _, tc := range []struct {
		name      string
		value     string
		want      int32
		wantError bool
	}{
		{name: "default", want: defaultMaxConns},
		{name: "configured", value: "12", want: 12},
		{name: "malformed", value: "many", wantError: true},
		{name: "zero", value: "0", wantError: true},
		{name: "overflow", value: "2147483648", wantError: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			if tc.value != "" {
				cfg.Raw.Section("error_tracking").Key("max_conns").SetValue(tc.value)
			}
			got, err := configuredMaxConns(cfg)
			if tc.wantError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}
}
