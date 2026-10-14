package unified

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/app"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// pluginRouter stands in for the router in this process serving one plugin group.
type pluginRouter struct{ manifest *app.ManifestData }

func (p pluginRouter) GroupManifest(group string) (*app.ManifestData, string, bool, error) {
	if group != p.manifest.Group {
		return nil, "", false, nil
	}
	return p.manifest, "key-1", true, nil
}

func TestResolveManifests_UsesLocalRouterWithoutConfig(t *testing.T) {
	const group = "appsdktest.ext.grafana.app"
	local := resource.ProvideLocalManifestSource()
	local.Set(pluginRouter{manifest: &app.ManifestData{
		AppName: "appsdktest",
		Group:   group,
		Versions: []app.ManifestVersion{{
			Name:   "v1alpha1",
			Served: true,
			Kinds: []app.ManifestVersionKind{{
				Kind:   "Thing",
				Plural: "Things",
				SearchFields: []app.ManifestVersionKindSearchField{{
					Name: "color", Path: "spec.color", Type: "string", Capabilities: []string{"filter"},
				}},
			}},
		}},
	}})
	opts := resource.SearchOptions{
		SearchFields:    resource.NewSearchFieldsRegistry(nil, nil, nil),
		EmbeddingConfig: resource.NewEmbeddingConfigRegistry(),
	}

	require.NoError(t, resolveManifests(setting.NewCfg(), nil, opts, local))

	key := resource.NewLowerGroupResource(group, "things")
	_, _, provider := opts.SearchFields.For(key)
	require.Nil(t, provider)

	opts.SearchFields.Resolve(t.Context(), key)
	_, _, provider = opts.SearchFields.For(key)
	require.NotNil(t, provider)
	fields := provider.Fields(schema.GroupVersionResource{Group: group, Version: "v1alpha1", Resource: "things"})
	require.Len(t, fields, 1)
	require.Equal(t, "color", fields[0].Name)
}
