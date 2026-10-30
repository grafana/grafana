package router

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/synctest"

	"github.com/grafana/authlib/authn"
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
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute/appsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
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
			store := storeOf(tc.bundles...)
			roles := &recordingManifestRoleService{}
			loader, err := ProvideRoutesLoader(setting.NewCfg(), PluginLoaderDependencies{
				PluginStore: store,
				ACService:   roles,
				PluginDependencies: PluginDependencies{
					PluginClient: struct{ plugins.Client }{},
					ContextProvider: struct {
						appsettings.PluginContextWrapper
					}{},
					Unified:       &resource.MockResourceClient{},
					AccessControl: &actest.FakeAccessControl{ExpectedEvaluate: true},
					Features:      featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware),
				},
			})
			require.NoError(t, err)
			require.Zero(t, roles.calls, "roles are declared as a plugin is loaded, not at construction")
			_, err = loader.Load(t.Context())
			require.NoError(t, err)
			require.Equal(t, 1, roles.calls)
			registered := byName(t, roles.roles)
			require.Len(t, registered, 2)
			require.Contains(t, registered, "fixed:manifest.ext.grafana.app:reader")
			require.Contains(t, registered, "fixed:manifest.ext.grafana.app:writer")
			router := NewGrafanaRouter(loader, nil)
			require.NoError(t, router.reconcile(t.Context()))
			for _, entry := range router.served {
				t.Cleanup(entry.handler.(interface{ Destroy() }).Destroy)
			}
			require.Len(t, router.served, 1)
			require.Equal(t, 1, roles.calls, "reconciliation must not redeclare roles")

			req := httptest.NewRequest(http.MethodGet, "/openapi/v3", nil)
			req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{
				Type: claims.TypeUser, OrgID: 1, Namespace: "default",
			}))
			res := httptest.NewRecorder()
			router.HandleFunc(res, req)
			require.Equal(t, http.StatusOK, res.Code, res.Body.String())
			var discovery handler3.OpenAPIV3Discovery
			require.NoError(t, json.Unmarshal(res.Body.Bytes(), &discovery))
			for _, gv := range []string{"manifest.ext.grafana.app/v1"} {
				require.Contains(t, discovery.Paths, "apis/"+gv)
				path := discovery.Paths["apis/"+gv].ServerRelativeURL
				document := httptest.NewRecorder()
				router.HandleFunc(document, httptest.NewRequest(http.MethodGet, path, nil).WithContext(req.Context()))
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
	t.Run("authenticates a core app, which has no plugin ID, by its API group", func(t *testing.T) {
		core := definition.PluginDefinition{Manifests: []*app.ManifestData{{
			AppName: "playlist", Group: "playlist.grafana.app",
			Versions: []app.ManifestVersion{{Name: "v1", Served: true}},
		}}}
		backend, err := testPluginBackend(t, core, func(context.Context, string) (plugins.Client, appclientv3.Client, error) {
			return nil, struct{ appclientv3.Client }{}, nil
		}, PluginDependencies{
			Unified:        &resource.MockResourceClient{},
			AccessControl:  &actest.FakeAccessControl{ExpectedEvaluate: true},
			TokenExchanger: authn.NewStaticTokenExchanger("token"),
		})
		require.NoError(t, err)
		handler, err := backend.Load(t.Context())
		require.NoError(t, err)
		t.Cleanup(handler.(interface{ Destroy() }).Destroy)
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
	router.HandleFunc(res, req)
	require.Equal(t, http.StatusOK, res.Code, res.Body.String())
	require.Contains(t, res.Header().Get("Cache-Control"), "private")

	access.ExpectedEvaluate = false
	for _, etag := range []string{"", res.Header().Get("ETag")} {
		req.Header.Set("If-None-Match", etag)
		denied := httptest.NewRecorder()
		router.HandleFunc(denied, req)
		require.Equal(t, http.StatusForbidden, denied.Code, denied.Body.String())
	}
}

func TestPluginLoaderSkipsInvalidManifest(t *testing.T) {
	valid := &plugins.FoundBundle{Primary: plugins.FoundPlugin{
		JSONData: plugins.JSONData{ID: "valid-app", Type: plugins.TypeApp},
		FS:       plugins.NewFakeFS(),
	}}
	// Claims a core group, which a local plugin may never serve.
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
	loader, err := ProvideRoutesLoader(setting.NewCfg(), PluginLoaderDependencies{
		PluginStore: storeOf(invalid, valid),
		PluginDependencies: PluginDependencies{
			PluginClient: struct{ plugins.Client }{},
			ContextProvider: struct {
				appsettings.PluginContextWrapper
			}{},
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

func TestInitLocalPluginRolesDeclarationFailure(t *testing.T) {
	failure := errors.New("role registration failed")
	plugin := mustDefinition(t, "manifest-app", `{"apiVersion":"apps.grafana.app/v1alpha2","spec":{"appName":"manifest","group":"manifest.ext.grafana.app","versions":[{"name":"v1","served":true,"kinds":[{"kind":"Thing","plural":"things","scope":"Namespaced"}]}]}}`)
	for _, missingService := range []bool{false, true} {
		t.Run(fmt.Sprintf("missingService=%t", missingService), func(t *testing.T) {
			var service accesscontrol.Service = &recordingManifestRoleService{err: failure}
			if missingService {
				service = nil
			}
			err := initLocalPlugin(t.Context(), PluginLoaderDependencies{ACService: service}, plugin)
			require.ErrorContains(t, err, "error declaring roles for manifest-app")
			if !missingService {
				require.ErrorIs(t, err, failure)
			}
		})
	}
}

func TestPluginBackendCoreGroups(t *testing.T) {
	plugin := func(group string) definition.PluginDefinition {
		return definition.PluginDefinition{
			JSONData:  plugins.JSONData{ID: "core-app"},
			Manifests: []*app.ManifestData{{AppName: "core", Group: group, Versions: []app.ManifestVersion{{Name: "v1", Served: true}}}},
		}
	}
	newBackend := func(group string) (*PluginBackend, error) {
		return testPluginBackend(t, plugin(group), nil, PluginDependencies{})
	}

	backend, err := newBackend("playlist.grafana.app")
	require.NoError(t, err)
	require.Equal(t, "playlist.grafana.app", backend.Group().Name)

	_, err = newBackend("dashboard.grafana.app")
	require.ErrorContains(t, err, "must end in .ext.grafana.app", "a core group that is not listed is never served")
	_, err = newBackend(".ext.grafana.app")
	require.Error(t, err)
}

func TestPluginBackendManifestGroupValidation(t *testing.T) {
	for _, group := range []string{"example.ext.grafana.app", "", "example.ext.grafana.com", "folder.grafana.app", "example-app"} {
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

func TestPluginLoaderInitializesPluginsOnlyInMiddleware(t *testing.T) {
	for _, tc := range []struct {
		name       string
		targets    []string
		features   []any
		initialize bool
	}{
		{name: "disabled"},
		{name: "unrelated target", targets: []string{"all"}},
		{name: "middleware", features: []any{featuremgmt.FlagGrafanaUseRouterMiddleware}, initialize: true},
		{name: "router target without middleware", targets: []string{"router"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			roles := &recordingManifestRoleService{}
			cfg := setting.NewCfg()
			cfg.Target = tc.targets
			loader, err := ProvideRoutesLoader(cfg, PluginLoaderDependencies{
				PluginStore:        storeOf(manifestBundle("manifest-app", `{"apiVersion":"apps.grafana.app/v1alpha2","spec":{"appName":"manifest","group":"manifest.ext.grafana.app","versions":[{"name":"v1","served":true,"kinds":[{"kind":"Thing","plural":"things","scope":"Namespaced"}]}]}}`)),
				ACService:          roles,
				PluginDependencies: PluginDependencies{Features: featuremgmt.WithFeatures(tc.features...)},
			})
			require.NoError(t, err)
			require.Zero(t, roles.calls, "construction declares nothing")
			_, err = loader.Load(t.Context())
			require.NoError(t, err)
			if tc.initialize {
				require.Equal(t, 1, roles.calls)
			} else {
				require.Zero(t, roles.calls, "without middleware, the router declares no roles")
			}
		})
	}
}

func TestPluginLoaderInitializesEachPluginOnce(t *testing.T) {
	roles := &recordingManifestRoleService{}
	store := pluginstore.NewFakePluginStore()
	loader := &PluginLoader{
		deps:  PluginLoaderDependencies{PluginStore: store, ACService: roles},
		inits: newLocalPluginInits(),
	}
	load := func() {
		t.Helper()
		_, err := loader.Load(t.Context())
		require.NoError(t, err)
	}

	load()
	require.Zero(t, roles.calls, "no plugins yet")

	store.PluginList = append(store.PluginList, storedPlugin(manifestBundle("manifest-app", `{"apiVersion":"apps.grafana.app/v1alpha2","spec":{"appName":"manifest","group":"manifest.ext.grafana.app","versions":[{"name":"v1","served":true,"kinds":[{"kind":"Thing","plural":"things","scope":"Namespaced"}]}]}}`)))
	load()
	load()
	require.Equal(t, 1, roles.calls, "a plugin that appears later is initialized once, however often Load runs")

	changed := manifestBundle("manifest-app", `{"apiVersion":"apps.grafana.app/v1alpha2","spec":{"appName":"manifest","group":"manifest.ext.grafana.app","versions":[{"name":"v2","served":true,"kinds":[{"kind":"Thing","plural":"things","scope":"Namespaced"}]}]}}`)
	changed.Primary.JSONData.Info.Version = "2.0.0"
	store.PluginList[0] = storedPlugin(changed)
	load()
	require.Equal(t, 1, roles.calls, "an updated plugin keeps its roles: redeclaring them would stack duplicate grants")

	other := `{"apiVersion":"apps.grafana.app/v1alpha2","spec":{"appName":"other","group":"other.ext.grafana.app","versions":[{"name":"v1","served":true,"kinds":[{"kind":"Thing","plural":"things","scope":"Namespaced"}]}]}}`
	store.PluginList = append(store.PluginList, storedPlugin(manifestBundle("other-app", other)))
	load()
	require.Equal(t, 2, roles.calls, "only the new plugin is initialized")
}

func TestPluginLoaderRetriesFailedInit(t *testing.T) {
	roles := &recordingManifestRoleService{err: errors.New("role registration failed")}
	loader := &PluginLoader{
		deps: PluginLoaderDependencies{
			PluginStore: storeOf(manifestBundle("manifest-app", `{"apiVersion":"apps.grafana.app/v1alpha2","spec":{"appName":"manifest","group":"manifest.ext.grafana.app","versions":[{"name":"v1","served":true,"kinds":[{"kind":"Thing","plural":"things","scope":"Namespaced"}]}]}}`)),
			ACService:   roles,
		},
		inits: newLocalPluginInits(),
	}
	_, err := loader.Load(t.Context())
	require.NoError(t, err, "a failed init must not fail the load")
	_, err = loader.Load(t.Context())
	require.NoError(t, err)
	require.Equal(t, 2, roles.calls, "a failed init is retried on the next load")

	roles.err = nil
	_, err = loader.Load(t.Context())
	require.NoError(t, err)
	_, err = loader.Load(t.Context())
	require.NoError(t, err)
	require.Equal(t, 3, roles.calls, "a successful init is not repeated")
}

func TestInitLocalPluginSkipsRoutableCoreGroups(t *testing.T) {
	plugin := mustDefinition(t, "playlist-app", `{"apiVersion":"apps.grafana.app/v1alpha2","spec":{"appName":"playlist","group":"playlist.grafana.app","versions":[{"name":"v1","served":true,"kinds":[{"kind":"Playlist","plural":"playlists","scope":"Namespaced"}]}]}}`)
	service := &recordingManifestRoleService{}
	require.NoError(t, initLocalPlugin(t.Context(), PluginLoaderDependencies{ACService: service}, plugin))
	require.Zero(t, service.calls, "a core group keeps the roles its own app declares")
}

func TestPluginLoaderDeclaresNoRolesWhenLoadFails(t *testing.T) {
	roles := &recordingManifestRoleService{}
	bundle := &plugins.FoundBundle{Primary: plugins.FoundPlugin{
		JSONData: plugins.JSONData{ID: "manifest-app", Type: plugins.TypeApp},
		FS: plugins.NewInMemoryFS(map[string][]byte{
			"schema/v0alpha1.json":  []byte(`{"targetApiVersion":`),
			"app-sdk-manifest.json": []byte(`{"apiVersion":"apps.grafana.app/v1alpha2","spec":{"appName":"manifest","group":"manifest.ext.grafana.app","versions":[{"name":"v1","served":true,"kinds":[{"kind":"Thing","plural":"things","scope":"Namespaced"}]}]}}`),
		}),
	}}
	loader := &PluginLoader{deps: PluginLoaderDependencies{PluginStore: storeOf(bundle), ACService: roles}, inits: newLocalPluginInits()}
	_, err := loader.Load(t.Context())
	require.ErrorContains(t, err, "error loading schema manifest-app")
	require.Zero(t, roles.calls, "a plugin that cannot be served declares no roles")
}

// storedPlugin is a bundle's primary plugin as the plugin store lists it.
func storedPlugin(b *plugins.FoundBundle) pluginstore.Plugin {
	return pluginstore.Plugin{JSONData: b.Primary.JSONData, FS: b.Primary.FS}
}

func storeOf(bundles ...*plugins.FoundBundle) *pluginstore.FakePluginStore {
	store := pluginstore.NewFakePluginStore()
	for _, b := range bundles {
		store.PluginList = append(store.PluginList, storedPlugin(b))
	}
	return store
}

func manifestBundle(id, manifest string) *plugins.FoundBundle {
	return &plugins.FoundBundle{Primary: plugins.FoundPlugin{
		JSONData: plugins.JSONData{ID: id, Type: plugins.TypeApp},
		FS:       plugins.NewInMemoryFS(map[string][]byte{"app-sdk-manifest.json": []byte(manifest)}),
	}}
}

func mustDefinition(t *testing.T, id, manifest string) definition.PluginDefinition {
	t.Helper()
	m, err := definition.ParseManifest([]byte(manifest))
	require.NoError(t, err)
	return definition.PluginDefinition{JSONData: plugins.JSONData{ID: id, Type: plugins.TypeApp}, Manifests: []*app.ManifestData{m}}
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

func TestPluginLoaderServesSettingsUnderPluginID(t *testing.T) {
	manifest := &app.ManifestData{AppName: "example", Group: "example.ext.grafana.app",
		Versions: []app.ManifestVersion{{Name: "v1", Served: true}}}
	defs := []definition.PluginDefinition{
		{JSONData: plugins.JSONData{ID: "example-app"}, Manifests: []*app.ManifestData{manifest}},
		{JSONData: plugins.JSONData{ID: "legacy-app"}},
		{JSONData: plugins.JSONData{ID: "Invalid-App"}},
	}
	groups := func(backends []Backend) []string {
		out := make([]string, 0, len(backends))
		for _, backend := range backends {
			out = append(out, backend.Group().Name)
		}
		return out
	}

	backends, err := (PluginLoader{}).prepareBackends(t.Context(), defs)
	require.NoError(t, err)
	require.Equal(t, []string{"example.ext.grafana.app"}, groups(backends), "a loader without settings serves only manifests")
	manifestKey := backends[0].Key()

	backends, err = (PluginLoader{settings: true}).prepareBackends(t.Context(), defs)
	require.NoError(t, err)
	require.Equal(t, []string{"example-app", "example.ext.grafana.app", "legacy-app"}, groups(backends),
		"every valid app plugin serves its settings, with or without a manifest")
	require.Equal(t, manifestKey, backends[1].Key(), "serving settings must not reload the manifest group")
	settings := backends[0].(*PluginBackend)
	require.Equal(t, "example-app", settings.pluginID)
	require.Nil(t, settings.manifest)
	_, ok := settings.Manifest()
	require.False(t, ok, "the settings group publishes no app manifest")
	require.Equal(t, "example-app/v0alpha1", settings.Group().PreferredVersion.GroupVersion)

	// Settings do not depend on the manifest, so a manifest change keeps the settings group serving.
	manifest.Versions = append(manifest.Versions, app.ManifestVersion{Name: "v2", Served: true})
	changed, err := (PluginLoader{settings: true}).prepareBackends(t.Context(), defs)
	require.NoError(t, err)
	require.Equal(t, settings.Key(), changed[0].Key())
	require.NotEqual(t, manifestKey, changed[1].Key())
}

func TestPluginSettingsBackendLoad(t *testing.T) {
	plugin := definition.PluginDefinition{JSONData: plugins.JSONData{ID: "example-app", Type: plugins.TypeApp}}
	deps := PluginDependencies{
		ContextProvider: struct {
			appsettings.PluginContextWrapper
		}{},
		Unified:       &resource.MockResourceClient{},
		AccessControl: &actest.FakeAccessControl{ExpectedEvaluate: true},
	}
	client := func(context.Context, string) (plugins.Client, appclientv3.Client, error) {
		return struct{ plugins.Client }{}, nil, nil
	}

	t.Run("serves the app resource and its subresources", func(t *testing.T) {
		backend, err := newPluginSettingsBackend(plugin, client, deps)
		require.NoError(t, err)
		handler, err := backend.Load(t.Context())
		require.NoError(t, err)
		t.Cleanup(handler.(interface{ Destroy() }).Destroy)

		req := httptest.NewRequest(http.MethodGet, "/apis/example-app/v0alpha1", nil)
		req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{
			Type: claims.TypeUser, OrgID: 1, Namespace: "default",
		}))
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		require.Equal(t, http.StatusOK, res.Code, res.Body.String())
		var resources metav1.APIResourceList
		require.NoError(t, json.Unmarshal(res.Body.Bytes(), &resources))
		names := make([]string, 0, len(resources.APIResources))
		for _, r := range resources.APIResources {
			names = append(names, r.Name)
		}
		require.Equal(t, []string{"app"}, names, "the subresources are plain handlers, not API resources")

		// Only the subresource handler answers this way, so it runs behind the
		// chain's request info.
		req = httptest.NewRequest(http.MethodGet, "/apis/example-app/v0alpha1/namespaces/default/app/other/health", nil).
			WithContext(req.Context())
		res = httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		require.Equal(t, http.StatusBadRequest, res.Code, res.Body.String())
		require.Contains(t, res.Body.String(), "name can only be: instance")

		for _, sub := range []string{"health", "resources/api", "proxy"} {
			req = httptest.NewRequest(http.MethodGet, "/apis/example-app/v1/namespaces/default/app/instance/"+sub, nil).
				WithContext(req.Context())
			res = httptest.NewRecorder()
			handler.ServeHTTP(res, req)
			require.Equal(t, http.StatusNotFound, res.Code, "%s under an unserved version: %s", sub, res.Body.String())
		}
	})

	t.Run("requires a plugin client", func(t *testing.T) {
		backend, err := newPluginSettingsBackend(plugin, func(context.Context, string) (plugins.Client, appclientv3.Client, error) {
			return nil, nil, nil
		}, deps)
		require.NoError(t, err)
		_, err = backend.Load(t.Context())
		require.ErrorContains(t, err, "settings require a plugin client")
	})

	t.Run("rejects plugin IDs that are not DNS labels", func(t *testing.T) {
		for _, id := range []string{"Invalid-App", "example", "example.ext-app", "under_score-app"} {
			_, err := newPluginSettingsBackend(definition.PluginDefinition{JSONData: plugins.JSONData{ID: id}}, client, deps)
			require.Error(t, err, id)
		}
	})
}

// The standalone router has no SQL settings store or dual writer, so its
// local plugin loader never serves settings, whatever the feature flag says.
func TestProvideRoutesLoaderServesSettingsOnlyInGrafana(t *testing.T) {
	for _, tc := range []struct {
		name     string
		target   []string
		settings bool
	}{
		{"grafana", nil, true},
		{"standalone router", []string{"router"}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			featuremgmt.WithEnabledFlags(t, featuremgmt.FlagApppluginsRegisterAPIServer)
			cfg := setting.NewCfg()
			cfg.Target = tc.target
			loader, err := ProvideRoutesLoader(cfg, PluginLoaderDependencies{
				PluginStore: pluginstore.NewFakePluginStore(),
				PluginDependencies: PluginDependencies{
					Features: featuremgmt.WithFeatures(),
				},
			})
			require.NoError(t, err)
			pl, ok := loader.(*PluginLoader)
			require.True(t, ok, "expected the local plugin loader, got %T", loader)
			require.Equal(t, tc.settings, pl.settings)
		})
	}
}

type fakePluginNotifier struct{ ch chan struct{} }

func (n fakePluginNotifier) Notify(context.Context) <-chan struct{} { return n.ch }

func TestPluginLoaderNotifyFollowsThePluginStore(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		source := fakePluginNotifier{ch: make(chan struct{}, 1)}
		wakes, err := PluginLoader{deps: PluginLoaderDependencies{PluginNotifier: source}}.Notify(ctx)
		require.NoError(t, err)

		synctest.Wait()
		select {
		case <-wakes:
			t.Fatal("woke without a plugin change")
		default:
		}

		source.ch <- struct{}{}
		synctest.Wait()
		select {
		case <-wakes:
		default:
			t.Fatal("a plugin change must wake the router")
		}
	})
}

func TestPluginLoaderNotifyWithoutNotifierNeverWakes(t *testing.T) {
	wakes, err := PluginLoader{}.Notify(t.Context())
	require.NoError(t, err)
	select {
	case <-wakes:
		t.Fatal("woke without a notifier")
	default:
	}
}

func TestMergeWakes(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		first, second := make(chan struct{}, 1), make(chan struct{}, 1)
		merged := mergeWakes(ctx, first, second)

		for _, in := range []chan struct{}{first, second} {
			in <- struct{}{}
			synctest.Wait()
			select {
			case <-merged:
			default:
				t.Fatal("a wake on any input must wake the merged channel")
			}
		}

		first <- struct{}{}
		second <- struct{}{}
		synctest.Wait()
		<-merged
		select {
		case <-merged:
			t.Fatal("wakes must coalesce into one")
		default:
		}

		// One input closing must not end the others.
		close(first)
		synctest.Wait()
		second <- struct{}{}
		synctest.Wait()
		select {
		case _, ok := <-merged:
			require.True(t, ok)
		default:
			t.Fatal("the remaining input must still wake")
		}

		cancel()
		synctest.Wait()
		_, ok := <-merged
		require.False(t, ok, "the merged channel closes with the context")
	})
}
