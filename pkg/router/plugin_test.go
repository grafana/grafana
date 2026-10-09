package router

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/handler3"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/plugins/manager/pluginfakes"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestPluginLoaderDiscoversManifestAlongsideLegacyApps(t *testing.T) {
	legacy := &plugins.FoundBundle{Primary: plugins.FoundPlugin{
		JSONData: plugins.JSONData{ID: "test-app-with-backend", Type: plugins.TypeApp},
		FS:       plugins.NewFakeFS(),
	}}
	manifest := &plugins.FoundBundle{Primary: plugins.FoundPlugin{
		JSONData: plugins.JSONData{ID: "manifest-app", Type: plugins.TypeApp},
		FS: plugins.NewInMemoryFS(map[string][]byte{
			"app-sdk-manifest.json": []byte(`{
				"apiVersion": "apps.grafana.app/v1alpha2",
				"spec": {"appName": "manifest", "group": "manifest.ext.grafana.app",
					"versions": [{"name": "v1", "served": true, "kinds": [{"kind": "Thing", "plural": "things", "scope": "Namespaced"}]}]}
			}`),
		}),
	}}
	for _, tc := range []struct {
		name    string
		bundles []*plugins.FoundBundle
	}{
		{"legacy first", []*plugins.FoundBundle{legacy, manifest}},
		{"manifest first", []*plugins.FoundBundle{manifest, legacy}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			discoveries := 0
			sources := &pluginfakes.FakeSourceRegistry{ListFunc: func(context.Context) []plugins.PluginSource {
				return []plugins.PluginSource{&pluginfakes.FakePluginSource{DiscoverFunc: func(context.Context) ([]*plugins.FoundBundle, error) {
					discoveries++
					return tc.bundles, nil
				}}}
			}}
			roles := &recordingManifestRoleService{}
			loader, err := ProvideRoutesLoader(setting.NewCfg(), PluginLoaderDependencies{
				PluginSources: sources,
				ACService:     roles,
				PluginDependencies: PluginDependencies{
					PluginClient:    struct{ plugins.Client }{},
					ContextProvider: struct{ appplugin.PluginContextWrapper }{},
					Unified:         &resource.MockResourceClient{},
					AccessControl:   &actest.FakeAccessControl{ExpectedEvaluate: true},
					Features:        featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware),
				},
			})
			require.NoError(t, err)
			require.Equal(t, 1, roles.calls, "roles must be declared before startup registers fixed roles")
			require.Equal(t, 1, discoveries, "construction needs only one role discovery pass")
			registered := byName(t, roles.roles)
			require.Len(t, registered, 2)
			require.Contains(t, registered, "fixed:manifest.ext.grafana.app:reader")
			require.Contains(t, registered, "fixed:manifest.ext.grafana.app:writer")
			_, err = loader.Load(t.Context())
			require.NoError(t, err)
			router := NewGrafanaRouter(loader, nil)
			require.NoError(t, router.reconcile(t.Context()))
			for _, entry := range router.served {
				t.Cleanup(entry.handler.(interface{ Destroy() }).Destroy)
			}
			require.Len(t, router.served, 1)
			require.Equal(t, 1, roles.calls, "reconciliation must not redeclare roles")
			require.Equal(t, 3, discoveries, "each Load must discover backends afresh")

			req := httptest.NewRequest(http.MethodGet, "/openapi/v3", nil)
			req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{
				Type: claims.TypeUser, OrgID: 1, Namespace: "default",
			}))
			res := httptest.NewRecorder()
			router.HandleFunc(res, req, http.NotFoundHandler())
			require.Equal(t, http.StatusOK, res.Code, res.Body.String())
			var discovery handler3.OpenAPIV3Discovery
			require.NoError(t, json.Unmarshal(res.Body.Bytes(), &discovery))
			for _, gv := range []string{"manifest.ext.grafana.app/v1"} {
				require.Contains(t, discovery.Paths, "apis/"+gv)
				path := discovery.Paths["apis/"+gv].ServerRelativeURL
				document := httptest.NewRecorder()
				router.HandleFunc(document, httptest.NewRequest(http.MethodGet, path, nil).WithContext(req.Context()), http.NotFoundHandler())
				require.Equal(t, http.StatusOK, document.Code, document.Body.String())
				require.Contains(t, document.Body.String(), gv)
			}
		})
	}
}

func TestPluginBackendKey(t *testing.T) {
	plugin := definition.PluginDefinition{
		JSONData: plugins.JSONData{ID: "test-app", Info: plugins.Info{Version: "1.0.0"}},
		Manifests: []*app.ManifestData{{
			AppName: "test", Group: "test.ext.grafana.app",
			Versions: []app.ManifestVersion{{Name: "v1alpha1", Served: true}},
		}},
	}
	key := func(plugin definition.PluginDefinition) string {
		t.Helper()
		backend, err := testPluginBackend(t, plugin, nil, PluginDependencies{})
		require.NoError(t, err)
		return backend.Key()
	}
	original := key(plugin)
	require.Equal(t, original, key(plugin), "unchanged definitions must not reload")

	t.Run("plugin routes", func(t *testing.T) {
		changed := plugin
		changed.JSONData.Routes = []*plugins.Route{{Path: "api", URL: "https://example.com"}}
		require.NotEqual(t, original, key(changed))
	})
	t.Run("settings schema", func(t *testing.T) {
		changed := plugin
		changed.Schemas = map[string]*pluginschema.PluginSchema{"v0alpha1": {
			SettingsSchema: &pluginschema.Settings{SecureValues: []pluginschema.SecureValueInfo{{Key: "token"}}},
		}}
		require.NotEqual(t, original, key(changed))
	})
	t.Run("plugin ID and version boundaries", func(t *testing.T) {
		changed := plugin
		changed.JSONData.ID += "1"
		changed.JSONData.Info.Version = ".0.0"
		require.NotEqual(t, original, key(changed))
	})
}

func TestPluginBackendLoad(t *testing.T) {
	plugin := definition.PluginDefinition{
		JSONData: plugins.JSONData{ID: "test-app"},
		Manifests: []*app.ManifestData{{
			AppName: "test", Group: "test.ext.grafana.app", PreferredVersion: "v1alpha1",
			Versions: []app.ManifestVersion{
				{Name: "v1alpha1", Served: true, Kinds: []app.ManifestVersionKind{{Kind: "Thing", Plural: "things", Scope: "Namespaced"}}},
				{Name: "v2alpha1", Served: false},
			},
		}},
	}
	t.Run("loads an API handler using the plugin's clients", func(t *testing.T) {
		calls := 0
		backend, err := testPluginBackend(t, plugin, func(ctx context.Context, id string) (plugins.Client, appclientv3.Client, error) {
			calls++
			require.Equal(t, plugin.JSONData.ID, id)
			return nil, nil, nil
		}, PluginDependencies{
			Unified:       &resource.MockResourceClient{},
			AccessControl: &actest.FakeAccessControl{ExpectedEvaluate: true},
		})
		require.NoError(t, err)
		require.Zero(t, calls)
		handler, err := backend.Load(t.Context())
		require.NoError(t, err)
		require.Equal(t, 1, calls)
		spans := setupRouterTracing(t)
		t.Cleanup(handler.(interface{ Destroy() }).Destroy)
		req := httptest.NewRequest(http.MethodGet, "/apis/"+plugin.Manifests[0].Group, nil)
		req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{
			Type: claims.TypeUser, OrgID: 1, Namespace: "default",
		}))
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		require.Equal(t, http.StatusOK, res.Code, res.Body.String())
		var found bool
		for _, span := range spans.Ended() {
			if span.Name() == "router.plugin" {
				found = true
				require.Contains(t, span.Attributes(), attribute.String("grafana.plugin.id", plugin.JSONData.ID))
				require.Contains(t, span.Attributes(), attribute.String("grafana.router.group", plugin.Manifests[0].Group))
				require.Contains(t, span.Attributes(), attribute.Int("http.response.status_code", http.StatusOK))
			}
		}
		require.True(t, found, "loaded plugin routes must emit a plugin span")
		var group metav1.APIGroup
		require.NoError(t, json.Unmarshal(res.Body.Bytes(), &group))
		require.Equal(t, backend.Group().Versions, group.Versions)
		require.Equal(t, backend.Group().PreferredVersion, group.PreferredVersion)
	})
	t.Run("propagates client errors", func(t *testing.T) {
		failure := errors.New("plugin unavailable")
		backend, err := testPluginBackend(t, plugin, func(context.Context, string) (plugins.Client, appclientv3.Client, error) {
			return nil, nil, failure
		}, PluginDependencies{})
		require.NoError(t, err)
		handler, err := backend.Load(t.Context())
		require.ErrorIs(t, err, failure)
		require.Nil(t, handler)
	})
}

func TestPluginBackendHybridSearchConfiguration(t *testing.T) {
	for _, tc := range []struct {
		name       string
		ini        string
		wantSearch bool
		wantHybrid bool
	}{
		{name: "defaults enable opted-in hybrid", wantSearch: true, wantHybrid: true},
		{name: "hybrid can be disabled independently", ini: "enable_hybrid_api = false", wantSearch: true},
		{name: "removed search setting is ignored", ini: "enable_search_api = false", wantSearch: true, wantHybrid: true},
		{name: "removed trash setting is ignored", ini: "enable_trash_api = false", wantSearch: true, wantHybrid: true},
		{name: "both removed settings are ignored", ini: "enable_search_api = false\nenable_trash_api = false", wantSearch: true, wantHybrid: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg, err := setting.NewCfgFromBytes([]byte("[grafana-apiserver]\n" + tc.ini))
			require.NoError(t, err)
			hybrid := true
			plugin := definition.PluginDefinition{
				JSONData: plugins.JSONData{ID: "test-app"},
				Manifests: []*app.ManifestData{{
					AppName: "test", Group: "test.ext.grafana.app", PreferredVersion: "v1alpha1",
					Versions: []app.ManifestVersion{{
						Name: "v1alpha1", Served: true,
						Kinds: []app.ManifestVersionKind{{
							Kind: "Thing", Plural: "things", Scope: "Namespaced",
							Search: &app.ManifestVersionKindSearch{Hybrid: &hybrid},
						}},
					}},
				}},
			}
			backend, err := testPluginBackend(t, plugin, func(context.Context, string) (plugins.Client, appclientv3.Client, error) {
				return nil, nil, nil
			}, PluginDependencies{
				Cfg: cfg, Unified: &resource.MockResourceClient{},
				AccessControl: &actest.FakeAccessControl{ExpectedEvaluate: true},
			})
			require.NoError(t, err)
			handler, err := backend.Load(t.Context())
			require.NoError(t, err)
			t.Cleanup(handler.(interface{ Destroy() }).Destroy)
			req := httptest.NewRequest(http.MethodGet, "/openapi/v3/apis/test.ext.grafana.app/v1alpha1", nil)
			req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{
				Type: claims.TypeUser, OrgID: 1, Namespace: "default",
			}))
			res := httptest.NewRecorder()
			handler.ServeHTTP(res, req)
			require.Equal(t, http.StatusOK, res.Code, res.Body.String())
			var oas spec3.OpenAPI
			require.NoError(t, json.Unmarshal(res.Body.Bytes(), &oas))
			root := "/apis/test.ext.grafana.app/v1alpha1/namespaces/{namespace}/things"
			_, search := oas.Paths.Paths[root+"/search"]
			_, hybridRoute := oas.Paths.Paths[root+"/search/hybrid"]
			require.Equal(t, tc.wantSearch, search)
			require.Equal(t, tc.wantHybrid, hybridRoute)
		})
	}
}

func TestPluginOpenAPIAuthorizationAfterSuccessfulRequest(t *testing.T) {
	access := &actest.FakeAccessControl{ExpectedEvaluate: true}
	backend, err := testPluginBackend(t, definition.PluginDefinition{
		JSONData:  plugins.JSONData{ID: "test-app", Type: plugins.TypeApp},
		Manifests: []*app.ManifestData{{AppName: "test", Group: "test.ext.grafana.app", Versions: []app.ManifestVersion{{Name: "v1", Served: true}}}},
	}, func(context.Context, string) (plugins.Client, appclientv3.Client, error) {
		return nil, nil, nil
	}, PluginDependencies{Unified: &resource.MockResourceClient{}, AccessControl: access})
	require.NoError(t, err)
	handler, err := backend.Load(t.Context())
	require.NoError(t, err)
	t.Cleanup(handler.(interface{ Destroy() }).Destroy)
	router := buildRouterWithBackend(backend.Group().Name, backend.Key(), handler)
	req := httptest.NewRequest(http.MethodGet, "/openapi/v3/apis/test.ext.grafana.app/v1", nil)
	req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{
		Type: claims.TypeUser, OrgID: 1, Namespace: "default",
	}))
	res := httptest.NewRecorder()
	router.HandleFunc(res, req, http.NotFoundHandler())
	require.Equal(t, http.StatusOK, res.Code, res.Body.String())
	require.Contains(t, res.Header().Get("Cache-Control"), "private")

	access.ExpectedEvaluate = false
	for _, etag := range []string{"", res.Header().Get("ETag")} {
		req.Header.Set("If-None-Match", etag)
		denied := httptest.NewRecorder()
		router.HandleFunc(denied, req, http.NotFoundHandler())
		require.Equal(t, http.StatusForbidden, denied.Code, denied.Body.String())
	}
}

func TestPluginLoaderSkipsInvalidManifest(t *testing.T) {
	valid := &plugins.FoundBundle{Primary: plugins.FoundPlugin{
		JSONData: plugins.JSONData{ID: "valid-app", Type: plugins.TypeApp},
		FS:       plugins.NewFakeFS(),
	}}
	// Claims a core group; building its API would panic, and serving it
	// would shadow the embedded server's dashboards.
	invalid := &plugins.FoundBundle{Primary: plugins.FoundPlugin{
		JSONData: plugins.JSONData{ID: "invalid-app", Type: plugins.TypeApp},
		FS: plugins.NewInMemoryFS(map[string][]byte{
			"app-sdk-manifest.json": []byte(`{
				"apiVersion": "apps.grafana.app/v1alpha2",
				"spec": {"appName": "invalid", "group": "dashboard.grafana.app",
					"versions": [{"name": "v1", "served": true, "kinds": [{"kind": "Thing", "plural": "things", "scope": "Namespaced"}]}]}
			}`),
		}),
	}}
	sources := &pluginfakes.FakeSourceRegistry{ListFunc: func(context.Context) []plugins.PluginSource {
		return []plugins.PluginSource{&pluginfakes.FakePluginSource{DiscoverFunc: func(context.Context) ([]*plugins.FoundBundle, error) {
			return []*plugins.FoundBundle{invalid, valid}, nil
		}}}
	}}
	loader, err := ProvideRoutesLoader(setting.NewCfg(), PluginLoaderDependencies{
		PluginSources: sources,
		PluginDependencies: PluginDependencies{
			PluginClient:    struct{ plugins.Client }{},
			ContextProvider: struct{ appplugin.PluginContextWrapper }{},
		},
	})
	require.NoError(t, err)
	backends, err := loader.Load(t.Context())
	require.NoError(t, err)
	require.Empty(t, backends, "legacy settings and invalid manifests are not routed")
}

type recordingManifestRoleService struct {
	accesscontrol.Service
	roles []accesscontrol.RoleRegistration
	calls int
	err   error
}

func (s *recordingManifestRoleService) DeclareFixedRoles(roles ...accesscontrol.RoleRegistration) error {
	s.calls++
	s.roles = append(s.roles, roles...)
	return s.err
}

func TestInitPluginRolesDeclarationFailure(t *testing.T) {
	failure := errors.New("role registration failed")
	for _, missingService := range []bool{false, true} {
		t.Run(fmt.Sprintf("missingService=%t", missingService), func(t *testing.T) {
			source := &pluginfakes.FakeSourceRegistry{ListFunc: func(context.Context) []plugins.PluginSource {
				return []plugins.PluginSource{&pluginfakes.FakePluginSource{DiscoverFunc: func(context.Context) ([]*plugins.FoundBundle, error) {
					return []*plugins.FoundBundle{{Primary: plugins.FoundPlugin{
						JSONData: plugins.JSONData{ID: "manifest-app", Type: plugins.TypeApp},
						FS: plugins.NewInMemoryFS(map[string][]byte{
							"app-sdk-manifest.json": []byte(`{"apiVersion":"apps.grafana.app/v1alpha2","spec":{"appName":"manifest","group":"manifest.ext.grafana.app","versions":[{"name":"v1","served":true,"kinds":[{"kind":"Thing","plural":"things","scope":"Namespaced"}]}]}}`),
						}),
					}}}, nil
				}}}
			}}
			var service accesscontrol.Service = &recordingManifestRoleService{err: failure}
			if missingService {
				service = nil
			}
			err := initLocalPlugins(t.Context(), PluginLoaderDependencies{PluginSources: source, ACService: service})
			require.ErrorContains(t, err, "error declaring roles for manifest-app")
			if !missingService {
				require.ErrorIs(t, err, failure)
			}
		})
	}
}

func TestPluginBackendManifestGroupValidation(t *testing.T) {
	for _, group := range []string{"example.ext.grafana.app", "", "example.ext.grafana.com", "example.grafana.app", "example-app"} {
		t.Run(group, func(t *testing.T) {
			backend, err := testPluginBackend(t, definition.PluginDefinition{
				JSONData:  plugins.JSONData{ID: "example-app"},
				Manifests: []*app.ManifestData{{AppName: "example", Group: group, Versions: []app.ManifestVersion{{Name: "v1", Served: true}}}},
			}, nil, PluginDependencies{})
			if group == "example.ext.grafana.app" {
				require.NoError(t, err)
				require.Equal(t, group, backend.Group().Name)
			} else {
				require.Error(t, err)
				require.Nil(t, backend)
			}
		})
	}
}

func TestPluginLoaderStartupDiscoveryRequiresMiddleware(t *testing.T) {
	for _, tc := range []struct {
		name            string
		targets         []string
		features        []any
		initializeRoles bool
	}{
		{name: "disabled"},
		{name: "unrelated target", targets: []string{"all"}},
		{name: "middleware", features: []any{featuremgmt.FlagGrafanaUseRouterMiddleware}, initializeRoles: true},
		{name: "router target without middleware", targets: []string{"router"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			failure := errors.New("plugin discovery failed")
			calls := 0
			source := &pluginfakes.FakeSourceRegistry{ListFunc: func(context.Context) []plugins.PluginSource {
				calls++
				return []plugins.PluginSource{&pluginfakes.FakePluginSource{DiscoverFunc: func(context.Context) ([]*plugins.FoundBundle, error) {
					return nil, failure
				}}}
			}}
			cfg := setting.NewCfg()
			cfg.Target = tc.targets
			loader, err := ProvideRoutesLoader(cfg, PluginLoaderDependencies{
				PluginSources:      source,
				PluginDependencies: PluginDependencies{Features: featuremgmt.WithFeatures(tc.features...)},
			})
			if tc.initializeRoles {
				require.ErrorIs(t, err, failure)
				require.Nil(t, loader)
				require.Equal(t, 1, calls)
			} else {
				require.NoError(t, err)
				require.Zero(t, calls, "without middleware, construction must not touch plugin sources")
				_, err = loader.Load(t.Context())
				require.ErrorIs(t, err, failure, "discovery remains deferred until Load")
				require.Equal(t, 1, calls)
			}
		})
	}
}

func TestInitPluginRolesDoesNotLoadSchemas(t *testing.T) {
	ctx := t.Context()
	roles := &recordingManifestRoleService{}
	source := &pluginfakes.FakeSourceRegistry{ListFunc: func(got context.Context) []plugins.PluginSource {
		require.Same(t, ctx, got)
		return []plugins.PluginSource{&pluginfakes.FakePluginSource{DiscoverFunc: func(context.Context) ([]*plugins.FoundBundle, error) {
			return []*plugins.FoundBundle{{Primary: plugins.FoundPlugin{
				JSONData: plugins.JSONData{ID: "manifest-app", Type: plugins.TypeApp},
				FS: plugins.NewInMemoryFS(map[string][]byte{
					"schema/v0alpha1.json":  []byte(`{"targetApiVersion":`),
					"app-sdk-manifest.json": []byte(`{"apiVersion":"apps.grafana.app/v1alpha2","spec":{"appName":"manifest","group":"manifest.ext.grafana.app","versions":[{"name":"v1","served":true,"kinds":[{"kind":"Thing","plural":"things","scope":"Namespaced"}]}]}}`),
				}),
			}}}, nil
		}}}
	}}
	deps := PluginLoaderDependencies{PluginSources: source, ACService: roles}
	err := initLocalPlugins(ctx, deps)
	require.NoError(t, err, "schema failures must not prevent role declaration")
	require.Equal(t, 1, roles.calls)
	require.Len(t, roles.roles, 2)
	loader := &PluginLoader{deps: deps}
	_, err = loader.Load(ctx)
	require.ErrorContains(t, err, "error loading schema manifest-app")
	require.Equal(t, 1, roles.calls, "Load must not redeclare roles")
}

func TestInitLocalPluginsResolvesSettingsStorageWildcard(t *testing.T) {
	source := &pluginfakes.FakeSourceRegistry{ListFunc: func(context.Context) []plugins.PluginSource {
		return []plugins.PluginSource{&pluginfakes.FakePluginSource{DiscoverFunc: func(context.Context) ([]*plugins.FoundBundle, error) {
			return []*plugins.FoundBundle{
				{Primary: plugins.FoundPlugin{JSONData: plugins.JSONData{ID: "wildcard-app", Type: plugins.TypeApp}, FS: plugins.NewInMemoryFS(nil)}},
				{Primary: plugins.FoundPlugin{JSONData: plugins.JSONData{ID: "explicit-app", Type: plugins.TypeApp}, FS: plugins.NewInMemoryFS(nil)}},
			}, nil
		}}}
	}}
	cfg := setting.NewCfg()
	cfg.UnifiedStorage = map[string]setting.UnifiedStorageConfig{
		"app.*-app":        {DualWriterMode: 1},
		"app.explicit-app": {DualWriterMode: 3},
	}
	err := initLocalPlugins(t.Context(), PluginLoaderDependencies{PluginSources: source, PluginDependencies: PluginDependencies{Cfg: cfg}})
	require.NoError(t, err)
	require.EqualValues(t, 1, cfg.UnifiedStorage["app.wildcard-app"].DualWriterMode, "the shared dual-write service must see the wildcard default")
	require.EqualValues(t, 3, cfg.UnifiedStorage["app.explicit-app"].DualWriterMode, "explicit config wins over the wildcard")
}

// testPluginBackend retains definition fixtures while exercising the manifest backend.
func testPluginBackend(t *testing.T, plugin definition.PluginDefinition, client PluginClientProvider, deps PluginDependencies) (*PluginBackend, error) {
	t.Helper()
	key, err := json.Marshal(plugin)
	require.NoError(t, err)
	var manifest *app.ManifestData
	if len(plugin.Manifests) > 0 {
		manifest = plugin.Manifests[0]
	}
	return newPluginBackend(plugin.JSONData.ID, manifest, client, deps, key)
}

func TestPluginLoaderPreparesMultipleManifests(t *testing.T) {
	first := &app.ManifestData{AppName: "example", Group: "first.ext.grafana.app",
		Versions: []app.ManifestVersion{{Name: "v1", Served: true}}}
	second := &app.ManifestData{AppName: "example", Group: "second.ext.grafana.app",
		Versions: []app.ManifestVersion{{Name: "v2", Served: true}}}
	defs := []definition.PluginDefinition{{
		JSONData:  plugins.JSONData{ID: "example-app"},
		Manifests: []*app.ManifestData{first, nil, {Group: "dashboard.grafana.app"}, second},
	}, {JSONData: plugins.JSONData{ID: "legacy-app"}}}
	loader := PluginLoader{}
	backends, err := loader.prepareBackends(t.Context(), defs)
	require.NoError(t, err)
	require.Len(t, backends, 2)
	require.Equal(t, first.Group, backends[0].Group().Name)
	require.Equal(t, second.Group, backends[1].Group().Name)
	require.NotEqual(t, backends[0].Key(), backends[1].Key())
	for _, backend := range backends {
		require.Equal(t, "example-app", backend.(*PluginBackend).pluginID)
	}
	require.Same(t, first, backends[0].(*PluginBackend).manifest)
	require.Same(t, second, backends[1].(*PluginBackend).manifest)

	again, err := loader.prepareBackends(t.Context(), defs)
	require.NoError(t, err)
	for i := range backends {
		require.Equal(t, backends[i].Key(), again[i].Key())
	}

	// Definition changes invalidate every group, even when the group names stay put.
	defs[0].JSONData.Info.Version = "2"
	updated, err := loader.prepareBackends(t.Context(), defs)
	require.NoError(t, err)
	for i := range backends {
		require.NotEqual(t, backends[i].Key(), updated[i].Key())
		require.Equal(t, "2", updated[i].(*PluginBackend).info.Version)
	}
	second.Versions = append(second.Versions, app.ManifestVersion{Name: "v3", Served: true})
	changed, err := loader.prepareBackends(t.Context(), defs)
	require.NoError(t, err)
	require.Equal(t, updated[0].Key(), changed[0].Key())
	require.NotEqual(t, updated[1].Key(), changed[1].Key())
}

func TestPluginLoaderIsolatesFingerprintFailure(t *testing.T) {
	good := &app.ManifestData{AppName: "example", Group: "good.ext.grafana.app",
		Versions: []app.ManifestVersion{{Name: "v1", Served: true}}}
	bad := *good
	bad.Group = "bad.ext.grafana.app"
	bad.Versions = append([]app.ManifestVersion(nil), good.Versions...)
	path := spec3.PathProps{Post: &spec3.Operation{}}
	path.Post.AddExtension("x-unencodable", func() {})
	bad.Versions[0].OpenAPI.Paths = map[string]spec3.PathProps{"/namespaces/{namespace}/bad": path}
	defs := []definition.PluginDefinition{
		{JSONData: plugins.JSONData{ID: "example-app"}, Manifests: []*app.ManifestData{&bad, good}},
		{JSONData: plugins.JSONData{ID: "other-app"}, Manifests: []*app.ManifestData{good}},
	}
	_, err := pluginManifestKeyData(defs[0], &bad, "")
	require.Error(t, err)
	backends, err := (PluginLoader{}).prepareBackends(t.Context(), defs)
	require.NoError(t, err)
	require.Len(t, backends, 2)
	require.Equal(t, "example-app", backends[0].(*PluginBackend).pluginID)
	require.Equal(t, "other-app", backends[1].(*PluginBackend).pluginID)
}
