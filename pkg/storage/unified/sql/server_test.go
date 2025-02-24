package sql

import (
	"strconv"
	"testing"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestIsHighAvailabilityEnabled(t *testing.T) {
	tests := []struct {
		name          string
		dbType        string
		haConfigValue *bool
		isHA          bool
	}{
		{
			name:          "SQLite should never have HA enabled",
			dbType:        migrator.SQLite,
			haConfigValue: boolPtr(true),
			isHA:          false,
		},
		{
			name:          "MySQL with HA enabled in config should default to true",
			dbType:        migrator.MySQL,
			haConfigValue: boolPtr(true),
			isHA:          true,
		},
		{
			name:          "MySQL with HA disabled in config should default to false",
			dbType:        migrator.MySQL,
			haConfigValue: boolPtr(false),
			isHA:          false,
		},
		{
			name:          "MySQL with no HA config should default to true",
			dbType:        migrator.MySQL,
			haConfigValue: nil,
			isHA:          true,
		},
		{
			name:          "Postgres with HA enabled in config should default to true",
			dbType:        migrator.Postgres,
			haConfigValue: boolPtr(true),
			isHA:          true,
		},
		{
			name:          "Postgres with HA disabled in config should default to false",
			dbType:        migrator.Postgres,
			haConfigValue: boolPtr(false),
			isHA:          false,
		},
		{
			name:          "Postgres with no HA config should default to true",
			dbType:        migrator.Postgres,
			haConfigValue: nil,
			isHA:          true,
		},
		{
			name:          "No database type set should default to true",
			dbType:        "",
			haConfigValue: nil,
			isHA:          true,
		},
		{
			name:          "No database type set with HA enabled in config should default to true",
			dbType:        "",
			haConfigValue: boolPtr(true),
			isHA:          true,
		},
		{
			name:          "No database type set with HA disabled in config should default to false",
			dbType:        "",
			haConfigValue: boolPtr(false),
			isHA:          false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg().SectionWithEnvOverrides("database")
			if tt.dbType != "" {
				cfg.Key("type").SetValue(tt.dbType)
			}

			if tt.haConfigValue != nil {
				cfg.Key("high_availability").SetValue(strconv.FormatBool(*tt.haConfigValue))
			}

			result := isHighAvailabilityEnabled(cfg)
			require.Equal(t, tt.isHA, result)
		})
	}
}

func boolPtr(b bool) *bool {
	return &b
}
