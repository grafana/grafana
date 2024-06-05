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

	getter := &sectionGetter{
		DynamicSection: cfg.SectionWithEnvOverrides("entity_api"),
	}
	engine, err := getEnginePostgres(getter, nil)

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

	getter := &sectionGetter{
		DynamicSection: cfg.SectionWithEnvOverrides("entity_api"),
	}
	engine, err := getEngineMySQL(getter, nil)

	assert.NotNil(t, engine)
	assert.NoError(t, err)
}
