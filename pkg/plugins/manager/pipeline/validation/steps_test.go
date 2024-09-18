package validation

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/stretchr/testify/require"
)

func TestAPIVersionValidation(t *testing.T) {
	s := APIVersionValidationStep()

	tests := []struct {
		name   string
		plugin *plugins.Plugin
		err    bool
	}{
		{
			name: "valid plugin",
			plugin: &plugins.Plugin{
				JSONData: plugins.JSONData{
					Backend:    true,
					Type:       plugins.TypeDataSource,
					APIVersion: "v0alpha1",
				},
			},
			err: false,
		},
		{
			name: "invalid plugin - not backend",
			plugin: &plugins.Plugin{
				JSONData: plugins.JSONData{
					Backend:    false,
					Type:       plugins.TypeDataSource,
					APIVersion: "v0alpha1",
				},
			},
			err: true,
		},
		{
			name: "invalid plugin - not datasource",
			plugin: &plugins.Plugin{
				JSONData: plugins.JSONData{
					Backend:    true,
					Type:       plugins.TypeApp,
					APIVersion: "v0alpha1",
				},
			},
			err: true,
		},
		{
			name: "invalid plugin - invalid API version",
			plugin: &plugins.Plugin{
				JSONData: plugins.JSONData{
					Backend:    true,
					Type:       plugins.TypeDataSource,
					APIVersion: "invalid",
				},
			},
			err: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := s(context.Background(), tt.plugin)
			if tt.err {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
