package appplugin

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
)

func TestGetAppPlugins(t *testing.T) {
	tests := []struct {
		name        string
		registry    *fakeSourceRegistry
		expectedIDs []string
		expectedErr bool
	}{
		{
			name:        "no sources returns empty list",
			registry:    &fakeSourceRegistry{},
			expectedIDs: nil,
		},
		{
			name: "returns only app plugins",
			registry: &fakeSourceRegistry{
				sources: []plugins.PluginSource{
					&fakePluginSource{bundles: []*plugins.FoundBundle{
						bundle("my-app", plugins.TypeApp),
						bundle("my-datasource", plugins.TypeDataSource),
						bundle("my-panel", plugins.TypePanel),
						bundle("another-app", plugins.TypeApp),
					}},
				},
			},
			expectedIDs: []string{"my-app", "another-app"},
		},
		{
			name: "deduplicates app plugins across sources",
			registry: &fakeSourceRegistry{
				sources: []plugins.PluginSource{
					&fakePluginSource{bundles: []*plugins.FoundBundle{
						bundle("my-app", plugins.TypeApp),
					}},
					&fakePluginSource{bundles: []*plugins.FoundBundle{
						bundle("my-app", plugins.TypeApp),
						bundle("other-app", plugins.TypeApp),
					}},
				},
			},
			expectedIDs: []string{"my-app", "other-app"},
		},
		{
			name: "propagates discover error",
			registry: &fakeSourceRegistry{
				sources: []plugins.PluginSource{
					&fakePluginSource{err: fmt.Errorf("discover failed")},
				},
			},
			expectedErr: true,
		},
		{
			name: "source with no app plugins returns empty list",
			registry: &fakeSourceRegistry{
				sources: []plugins.PluginSource{
					&fakePluginSource{bundles: []*plugins.FoundBundle{
						bundle("ds-1", plugins.TypeDataSource),
						bundle("panel-1", plugins.TypePanel),
					}},
				},
			},
			expectedIDs: nil,
		},
		{
			name: "stops on first source error",
			registry: &fakeSourceRegistry{
				sources: []plugins.PluginSource{
					&fakePluginSource{bundles: []*plugins.FoundBundle{
						bundle("my-app", plugins.TypeApp),
					}},
					&fakePluginSource{err: fmt.Errorf("second source failed")},
				},
			},
			expectedErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := getAppPlugins(context.Background(), tt.registry)

			if tt.expectedErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			var ids []string
			for _, p := range result {
				ids = append(ids, p.ID)
			}
			require.Equal(t, tt.expectedIDs, ids)
		})
	}
}

type fakePluginSource struct {
	bundles []*plugins.FoundBundle
	err     error
}

func (f *fakePluginSource) PluginClass(context.Context) plugins.Class { return plugins.ClassExternal }
func (f *fakePluginSource) DefaultSignature(context.Context, string) (plugins.Signature, bool) {
	return plugins.Signature{}, false
}
func (f *fakePluginSource) Discover(context.Context) ([]*plugins.FoundBundle, error) {
	return f.bundles, f.err
}

type fakeSourceRegistry struct {
	sources []plugins.PluginSource
}

func (f *fakeSourceRegistry) List(context.Context) []plugins.PluginSource {
	return f.sources
}

func bundle(id string, pluginType plugins.Type) *plugins.FoundBundle {
	return &plugins.FoundBundle{
		Primary: plugins.FoundPlugin{
			JSONData: plugins.JSONData{ID: id, Type: pluginType},
		},
	}
}
