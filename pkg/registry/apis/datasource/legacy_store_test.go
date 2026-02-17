package datasource

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/datasources"
)

func TestLegacyStorageValidateURL(t *testing.T) {
	tests := []struct {
		name       string
		pluginType string
		url        string
		wantErr    bool
		errContains string
	}{
		{
			name:       "empty URL for required type returns error",
			pluginType: datasources.DS_PROMETHEUS,
			url:        "",
			wantErr:    true,
			errContains: "URL is required",
		},
		{
			name:       "empty URL for optional type passes",
			pluginType: "grafana-testdata-datasource",
			url:        "",
			wantErr:    false,
		},
		{
			name:       "valid URL passes",
			pluginType: datasources.DS_PROMETHEUS,
			url:        "http://localhost:9090",
			wantErr:    false,
		},
		{
			name:       "URL without protocol passes (prepends http)",
			pluginType: datasources.DS_PROMETHEUS,
			url:        "localhost:9090",
			wantErr:    false,
		},
		{
			name:       "valid MSSQL connection string passes",
			pluginType: "mssql",
			url:        "server:1433",
			wantErr:    false,
		},
		{
			name:       "MSSQL connection string with instance passes",
			pluginType: "mssql",
			url:        `server\instance:1433`,
			wantErr:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &legacyStorage{
				pluginType: tt.pluginType,
			}

			err := s.validateURL(tt.url)
			if tt.wantErr {
				require.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

// Note: Auth proxy header validation tests have been moved to register_test.go
// as the validation now happens in the admission layer (DataSourceAPIBuilder.Validate)
