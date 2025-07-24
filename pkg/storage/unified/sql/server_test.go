package sql

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestIsHighAvailabilityEnabled(t *testing.T) {
	tests := []struct {
		name string
		cfg  *setting.Cfg
		isHA bool
	}{
		{
			name: "SQLite should never have HA enabled",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("type").SetValue(migrator.SQLite)
				dbSection.Key("high_availability").SetValue("true")
				return cfg
			}(),
			isHA: false,
		},
		{
			name: "MySQL with HA enabled in config should default to true",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("type").SetValue(migrator.MySQL)
				dbSection.Key("high_availability").SetValue("true")
				return cfg
			}(),
			isHA: true,
		},
		{
			name: "MySQL with HA disabled in config should default to false",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("type").SetValue(migrator.MySQL)
				dbSection.Key("high_availability").SetValue("false")
				return cfg
			}(),
			isHA: false,
		},
		{
			name: "MySQL with no HA config should default to true",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("type").SetValue(migrator.MySQL)
				return cfg
			}(),
			isHA: true,
		},
		{
			name: "Postgres with HA enabled in config should default to true",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("type").SetValue(migrator.Postgres)
				dbSection.Key("high_availability").SetValue("true")
				return cfg
			}(),
			isHA: true,
		},
		{
			name: "Postgres with HA disabled in config should default to false",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("type").SetValue(migrator.Postgres)
				dbSection.Key("high_availability").SetValue("false")
				return cfg
			}(),
			isHA: false,
		},
		{
			name: "Postgres with no HA config should default to true",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("type").SetValue(migrator.Postgres)
				return cfg
			}(),
			isHA: true,
		},
		{
			name: "No database type set should default to true",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				_ = cfg.SectionWithEnvOverrides("database")
				return cfg
			}(),
			isHA: true,
		},
		{
			name: "No database type set with HA enabled in config should default to true",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("high_availability").SetValue("true")
				return cfg
			}(),
			isHA: true,
		},
		{
			name: "No database type set with HA disabled in config should default to false",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("high_availability").SetValue("false")
				return cfg
			}(),
			isHA: false,
		},
		{
			name: "Resource API with non-SQLite database type should default to true",
			cfg: func() *setting.Cfg {
				cfg := setting.NewCfg()
				dbSection := cfg.SectionWithEnvOverrides("database")
				dbSection.Key("type").SetValue(migrator.SQLite)
				resourceAPISection := cfg.SectionWithEnvOverrides("resource_api")
				resourceAPISection.Key("db_type").SetValue(migrator.Postgres)
				return cfg
			}(),
			isHA: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isHighAvailabilityEnabled(tt.cfg.SectionWithEnvOverrides("database"),
				tt.cfg.SectionWithEnvOverrides("resource_api"))
			require.Equal(t, tt.isHA, result)
		})
	}
}
