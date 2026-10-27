package appsettings

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

func TestBuilderOnlyServesSettings(t *testing.T) {
	// A manifest's kinds belong to its own group, so the settings builder ignores them.
	manifest := &app.ManifestData{AppName: "example", Group: "example.ext.grafana.app",
		Versions: []app.ManifestVersion{{Name: "v1alpha1", Served: true,
			Kinds: []app.ManifestVersionKind{{Kind: "TestKind", Plural: "testkinds", Scope: "Namespaced"}}}}}
	b, err := NewBuilder(definition.PluginDefinition{
		JSONData:  plugins.JSONData{ID: "example-app"},
		Manifests: []*app.ManifestData{manifest},
	}, struct{ PluginClient }{}, struct{ PluginContextWrapper }{}, nil, nil, Options{}, nil, nil)
	require.NoError(t, err)
	gv := schema.GroupVersion{Group: "example-app", Version: apppluginV0.VERSION}
	require.Equal(t, []schema.GroupVersion{gv}, b.GetGroupVersions())
	scheme := builder.ProvideScheme()
	require.NoError(t, b.InstallSchema(scheme))
	require.True(t, scheme.Recognizes(gv.WithKind("Settings")))
	require.False(t, scheme.Recognizes(gv.WithKind("TestKind")))

	info := &genericapiserver.APIGroupInfo{VersionedResourcesStorageMap: map[string]map[string]rest.Storage{}}
	require.NoError(t, b.UpdateAPIGroupInfo(info, builder.APIGroupOptions{
		Scheme: scheme, OptsGetter: appinstaller.NewNoopRESTOptionsGetter(),
	}))
	require.Len(t, info.VersionedResourcesStorageMap, 1)
	storage := info.VersionedResourcesStorageMap[gv.Version]
	require.Len(t, storage, 1, "the subresources are served by SubresourceHandler")
	require.Contains(t, storage, "app")
	_, mutates := any(b).(builder.APIGroupMutation)
	_, validates := any(b).(builder.APIGroupValidation)
	require.False(t, mutates)
	require.False(t, validates)
}

type settingsContextFunc func(context.Context, string, *backend.AppInstanceSettings) (context.Context, backend.PluginContext, error)

func (f settingsContextFunc) PluginContextForApp(ctx context.Context, id string, settings *backend.AppInstanceSettings) (context.Context, backend.PluginContext, error) {
	return f(ctx, id, settings)
}
