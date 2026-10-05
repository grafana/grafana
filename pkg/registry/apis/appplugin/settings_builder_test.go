package appplugin

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

func TestAppPluginAPIBuilderOnlyServesSettings(t *testing.T) {
	manifest := testManifest(t)
	b, err := NewAppPluginAPIBuilder(definition.PluginDefinition{
		JSONData: plugins.JSONData{ID: "example-app"},
		Manifest: manifest,
	}, struct{ PluginClient }{}, struct{ PluginContextWrapper }{}, nil, nil, AppPluginRunnerOptions{}, nil, nil)
	require.NoError(t, err)
	gv := schema.GroupVersion{Group: manifest.Group, Version: apppluginV0.VERSION}
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
	require.Len(t, storage, 3)
	require.Contains(t, storage, "app")
	require.Contains(t, storage, "app/health")
	require.Contains(t, storage, "app/resources")
	_, mutates := any(b).(builder.APIGroupMutation)
	_, validates := any(b).(builder.APIGroupValidation)
	require.False(t, mutates)
	require.False(t, validates)

	b.getter = func(context.Context, schema.GroupVersionResource, string) (runtime.Object, error) {
		return &apppluginV0.Settings{Spec: apppluginV0.SettingsSpec{Enabled: true}}, nil
	}
	b.contextProvider = settingsContextFunc(func(ctx context.Context, _ string, settings *backend.AppInstanceSettings) (context.Context, backend.PluginContext, error) {
		require.Equal(t, "v1alpha1", settings.APIVersion)
		return ctx, backend.PluginContext{}, nil
	})
	ctx := request.WithRequestInfo(t.Context(), &request.RequestInfo{APIVersion: "v1alpha1"})
	_, _, err = storage["app/health"].(*subHealthREST).contextProvider(ctx)
	require.NoError(t, err)
}

type settingsContextFunc func(context.Context, string, *backend.AppInstanceSettings) (context.Context, backend.PluginContext, error)

func (f settingsContextFunc) PluginContextForApp(ctx context.Context, id string, settings *backend.AppInstanceSettings) (context.Context, backend.PluginContext, error) {
	return f(ctx, id, settings)
}
