package dbimpl

import (
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetEnginePostgresFromConfig(t *testing.T) {
	cfg := setting.NewCfg()
	s, err := cfg.Raw.NewSection("entity_api")
	require.NoError(t, err)
	s.Key("db_type").SetValue("mysql")
	s.Key("db_host").SetValue("localhost")
	s.Key("db_name").SetValue("grafana")
	s.Key("db_user").SetValue("user")
	s.Key("db_password").SetValue("password")

	engine, err := getEnginePostgres(cfg.SectionWithEnvOverrides("entity_api"), nil)

	assert.NotNil(t, engine)
	assert.NoError(t, err)
	assert.True(t, strings.Contains(engine.DataSourceName(), "dbname=grafana"))
}

func TestGetEngineMySQLFromConfig(t *testing.T) {
	cfg := setting.NewCfg()
	s, err := cfg.Raw.NewSection("entity_api")
	require.NoError(t, err)
	s.Key("db_type").SetValue("mysql")
	s.Key("db_host").SetValue("localhost")
	s.Key("db_name").SetValue("grafana")
	s.Key("db_user").SetValue("user")
	s.Key("db_password").SetValue("password")

	engine, err := getEngineMySQL(cfg.SectionWithEnvOverrides("entity_api"), nil)

	assert.NotNil(t, engine)
	assert.NoError(t, err)
}

func TestGetConnectionStrings(t *testing.T) {
	t.Run("generate mysql connection string", func(t *testing.T) {
		expected := "user:password@tcp(localhost)/grafana?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true"
		assert.Equal(t, expected, connectionStringMySQL("user", "password", "tcp", "localhost", "grafana"))
	})
	t.Run("generate postgres connection string", func(t *testing.T) {
		expected := "user=user password=password host=localhost port=5432 dbname=grafana sslmode=disable"
		assert.Equal(t, expected, connectionStringPostgres("user", "password", "localhost", "5432", "grafana", "disable"))
	})
}
