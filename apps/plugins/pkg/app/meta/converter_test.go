package meta

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/auth"
	"github.com/grafana/grafana/pkg/plugins/pluginassets"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

func TestJsonDataToMetaJSONData(t *testing.T) {
	t.Run("converts plugin types", func(t *testing.T) {
		testCases := []struct {
			name       string
			pluginType plugins.Type
			expected   pluginsv0alpha1.MetaJSONDataType
		}{
			{"app", plugins.TypeApp, pluginsv0alpha1.MetaJSONDataTypeApp},
			{"datasource", plugins.TypeDataSource, pluginsv0alpha1.MetaJSONDataTypeDatasource},
			{"panel", plugins.TypePanel, pluginsv0alpha1.MetaJSONDataTypePanel},
			{"renderer", plugins.TypeRenderer, pluginsv0alpha1.MetaJSONDataTypeRenderer},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				jsonData := plugins.JSONData{ID: "test", Name: "Test", Type: tc.pluginType}
				meta := jsonDataToMetaJSONData(jsonData)
				assert.Equal(t, tc.expected, meta.Type)
			})
		}
	})

	t.Run("converts categories", func(t *testing.T) {
		testCases := []struct {
			category string
			expected pluginsv0alpha1.MetaJSONDataCategory
		}{
			{"tsdb", pluginsv0alpha1.MetaJSONDataCategoryTsdb},
			{"logging", pluginsv0alpha1.MetaJSONDataCategoryLogging},
			{"cloud", pluginsv0alpha1.MetaJSONDataCategoryCloud},
			{"tracing", pluginsv0alpha1.MetaJSONDataCategoryTracing},
			{"profiling", pluginsv0alpha1.MetaJSONDataCategoryProfiling},
			{"sql", pluginsv0alpha1.MetaJSONDataCategorySql},
			{"enterprise", pluginsv0alpha1.MetaJSONDataCategoryEnterprise},
			{"iot", pluginsv0alpha1.MetaJSONDataCategoryIot},
			{"other", pluginsv0alpha1.MetaJSONDataCategoryOther},
			{"unknown", pluginsv0alpha1.MetaJSONDataCategoryOther},
		}

		for _, tc := range testCases {
			t.Run(tc.category, func(t *testing.T) {
				jsonData := plugins.JSONData{ID: "test", Name: "Test", Type: plugins.TypeDataSource, Category: tc.category}
				meta := jsonDataToMetaJSONData(jsonData)
				require.NotNil(t, meta.Category)
				assert.Equal(t, tc.expected, *meta.Category)
			})
		}
	})

	t.Run("converts states", func(t *testing.T) {
		testCases := []struct {
			state    plugins.ReleaseState
			expected pluginsv0alpha1.MetaJSONDataState
		}{
			{plugins.ReleaseStateAlpha, pluginsv0alpha1.MetaJSONDataStateAlpha},
			{plugins.ReleaseStateBeta, pluginsv0alpha1.MetaJSONDataStateBeta},
			{"stable", pluginsv0alpha1.MetaJSONDataStateStable},
			{"deprecated", pluginsv0alpha1.MetaJSONDataStateDeprecated},
		}

		for _, tc := range testCases {
			t.Run(string(tc.state), func(t *testing.T) {
				jsonData := plugins.JSONData{ID: "test", Name: "Test", Type: plugins.TypeDataSource, State: tc.state}
				meta := jsonDataToMetaJSONData(jsonData)
				require.NotNil(t, meta.State)
				assert.Equal(t, tc.expected, *meta.State)
			})
		}

		t.Run("invalid state returns nil", func(t *testing.T) {
			jsonData := plugins.JSONData{ID: "test", Name: "Test", Type: plugins.TypeDataSource, State: "invalid"}
			meta := jsonDataToMetaJSONData(jsonData)
			assert.Nil(t, meta.State)
		})
	})

	t.Run("converts info fields", func(t *testing.T) {
		buildTime := int64(1234567890)
		jsonData := plugins.JSONData{
			ID:   "test-plugin",
			Name: "Test Plugin",
			Type: plugins.TypeDataSource,
			Info: plugins.Info{
				Version:     "1.2.3",
				Description: "Test description",
				Keywords:    []string{"test", "plugin", "datasource"},
				Logos:       plugins.Logos{Small: "small.png", Large: "large.png"},
				Updated:     "2023-01-01",
				Build:       plugins.BuildInfo{Time: buildTime},
				Author:      plugins.InfoLink{Name: "Test Author", URL: "https://example.com"},
				Links: []plugins.InfoLink{
					{Name: "Documentation", URL: "https://docs.example.com"},
					{Name: "Support", URL: "https://support.example.com"},
				},
				Screenshots: []plugins.Screenshots{
					{Name: "Screenshot 1", Path: "screenshot1.png"},
					{Name: "Screenshot 2", Path: "screenshot2.png"},
				},
			},
		}

		meta := jsonDataToMetaJSONData(jsonData)
		assert.Equal(t, "1.2.3", meta.Info.Version)
		assert.Equal(t, "Test description", *meta.Info.Description)
		assert.Equal(t, []string{"test", "plugin", "datasource"}, meta.Info.Keywords)
		assert.Equal(t, "small.png", meta.Info.Logos.Small)
		assert.Equal(t, "large.png", meta.Info.Logos.Large)
		assert.Equal(t, "2023-01-01", meta.Info.Updated)
		assert.Equal(t, float64(buildTime), *meta.Info.Build.Time)
		assert.Equal(t, "Test Author", *meta.Info.Author.Name)
		assert.Equal(t, "https://example.com", *meta.Info.Author.Url)
		assert.Len(t, meta.Info.Links, 2)
		assert.Len(t, meta.Info.Screenshots, 2)
	})

	t.Run("converts dependencies", func(t *testing.T) {
		jsonData := plugins.JSONData{
			ID:   "test-plugin",
			Name: "Test Plugin",
			Type: plugins.TypeDataSource,
			Dependencies: plugins.Dependencies{
				GrafanaDependency: ">=8.0.0",
				GrafanaVersion:    "8.0.0",
				Plugins: []plugins.Dependency{
					{ID: "plugin1", Type: "app", Name: "Plugin 1"},
					{ID: "plugin2", Type: "datasource", Name: "Plugin 2"},
					{ID: "plugin3", Type: "panel", Name: "Plugin 3"},
				},
				Extensions: plugins.ExtensionsDependencies{
					ExposedComponents: []string{"component1", "component2"},
				},
			},
		}

		meta := jsonDataToMetaJSONData(jsonData)
		assert.Equal(t, ">=8.0.0", meta.Dependencies.GrafanaDependency)
		assert.Equal(t, "8.0.0", *meta.Dependencies.GrafanaVersion)
		assert.Len(t, meta.Dependencies.Plugins, 3)
		assert.Equal(t, pluginsv0alpha1.MetaV0alpha1DependenciesPluginsTypeApp, meta.Dependencies.Plugins[0].Type)
		assert.Equal(t, pluginsv0alpha1.MetaV0alpha1DependenciesPluginsTypeDatasource, meta.Dependencies.Plugins[1].Type)
		assert.Equal(t, pluginsv0alpha1.MetaV0alpha1DependenciesPluginsTypePanel, meta.Dependencies.Plugins[2].Type)
		assert.Equal(t, []string{"component1", "component2"}, meta.Dependencies.Extensions.ExposedComponents)
	})

	t.Run("converts boolean fields", func(t *testing.T) {
		jsonData := plugins.JSONData{
			ID:                        "test-plugin",
			Name:                      "Test Plugin",
			Type:                      plugins.TypeDataSource,
			Alerting:                  true,
			Annotations:               true,
			AutoEnabled:               true,
			Backend:                   true,
			BuiltIn:                   true,
			HideFromList:              true,
			Logs:                      true,
			Metrics:                   true,
			MultiValueFilterOperators: true,
			Preload:                   true,
			SkipDataQuery:             true,
			Streaming:                 true,
			Tracing:                   true,
		}

		meta := jsonDataToMetaJSONData(jsonData)
		assert.True(t, *meta.Alerting)
		assert.True(t, *meta.Annotations)
		assert.True(t, *meta.AutoEnabled)
		assert.True(t, *meta.Backend)
		assert.True(t, *meta.BuiltIn)
		assert.True(t, *meta.HideFromList)
		assert.True(t, *meta.Logs)
		assert.True(t, *meta.Metrics)
		assert.True(t, *meta.MultiValueFilterOperators)
		assert.True(t, *meta.Preload)
		assert.True(t, *meta.SkipDataQuery)
		assert.True(t, *meta.Streaming)
		assert.True(t, *meta.Tracing)
	})

	t.Run("omits optional fields when empty", func(t *testing.T) {
		jsonData := plugins.JSONData{
			ID:   "test-plugin",
			Name: "Test Plugin",
			Type: plugins.TypePanel,
			Info: plugins.Info{Version: "1.0.0"},
		}

		meta := jsonDataToMetaJSONData(jsonData)
		assert.Nil(t, meta.Info.Description)
		assert.Nil(t, meta.Info.Build)
		assert.Nil(t, meta.Info.Author)
		assert.Empty(t, meta.Info.Links)
		assert.Empty(t, meta.Info.Screenshots)
		assert.Nil(t, meta.Alerting)
		assert.Nil(t, meta.Executable)
		assert.Empty(t, meta.Includes)
		assert.Empty(t, meta.Routes)
		assert.Empty(t, meta.Roles)
		assert.Nil(t, meta.Iam)
	})

	t.Run("converts includes", func(t *testing.T) {
		jsonData := plugins.JSONData{
			ID:   "test-plugin",
			Name: "Test Plugin",
			Type: plugins.TypeApp,
			Includes: []*plugins.Includes{
				{
					UID:        "dashboard-1",
					Type:       "dashboard",
					Name:       "Dashboard 1",
					Component:  "dashboard",
					Role:       identity.RoleAdmin,
					Action:     "read",
					Path:       "/dashboards/1",
					AddToNav:   true,
					DefaultNav: true,
					Icon:       "dashboard",
				},
				{UID: "page-1", Type: "page", Name: "Page 1", Role: identity.RoleViewer},
			},
		}

		meta := jsonDataToMetaJSONData(jsonData)
		assert.Len(t, meta.Includes, 2)
		assert.Equal(t, "dashboard-1", *meta.Includes[0].Uid)
		assert.Equal(t, pluginsv0alpha1.MetaIncludeTypeDashboard, *meta.Includes[0].Type)
		assert.Equal(t, pluginsv0alpha1.MetaIncludeRoleAdmin, *meta.Includes[0].Role)
		assert.Equal(t, pluginsv0alpha1.MetaIncludeRoleViewer, *meta.Includes[1].Role)
	})

	t.Run("converts include role types", func(t *testing.T) {
		testCases := []struct {
			role     identity.RoleType
			expected pluginsv0alpha1.MetaIncludeRole
		}{
			{identity.RoleAdmin, pluginsv0alpha1.MetaIncludeRoleAdmin},
			{identity.RoleEditor, pluginsv0alpha1.MetaIncludeRoleEditor},
			{identity.RoleViewer, pluginsv0alpha1.MetaIncludeRoleViewer},
			{identity.RoleNone, pluginsv0alpha1.MetaIncludeRoleNone},
		}

		for _, tc := range testCases {
			t.Run(string(tc.role), func(t *testing.T) {
				jsonData := plugins.JSONData{
					ID:       "test-plugin",
					Name:     "Test Plugin",
					Type:     plugins.TypeApp,
					Includes: []*plugins.Includes{{Role: tc.role}},
				}
				meta := jsonDataToMetaJSONData(jsonData)
				require.Len(t, meta.Includes, 1)
				assert.Equal(t, tc.expected, *meta.Includes[0].Role)
			})
		}
	})

	t.Run("converts routes", func(t *testing.T) {
		jsonData := plugins.JSONData{
			ID:   "test-plugin",
			Name: "Test Plugin",
			Type: plugins.TypeApp,
			Routes: []*plugins.Route{
				{
					Path:      "/api/endpoint",
					Method:    "GET",
					URL:       "https://api.example.com",
					ReqRole:   identity.RoleAdmin,
					ReqAction: "read",
					Headers:   []plugins.Header{{Name: "Authorization", Content: "Bearer token"}},
					URLParams: []plugins.URLParam{{Name: "param1", Content: "value1"}},
					TokenAuth: &plugins.JWTTokenAuth{
						Url:    "https://auth.example.com/token",
						Scopes: []string{"read", "write"},
						Params: map[string]string{
							"grant_type":    "client_credentials",
							"client_id":     "client123",
							"client_secret": "secret123",
							"resource":      "api://resource",
						},
					},
					JwtTokenAuth: &plugins.JWTTokenAuth{
						Url:    "https://jwt.example.com/token",
						Scopes: []string{"read"},
						Params: map[string]string{
							"token_uri":    "https://jwt.example.com/token",
							"client_email": "client@example.com",
							"private_key":  "key123",
						},
					},
					Body: json.RawMessage(`{"key": "value"}`),
				},
			},
		}

		meta := jsonDataToMetaJSONData(jsonData)
		assert.Len(t, meta.Routes, 1)
		assert.Equal(t, "/api/endpoint", *meta.Routes[0].Path)
		assert.Equal(t, "Admin", *meta.Routes[0].ReqRole)
		assert.NotNil(t, meta.Routes[0].TokenAuth)
		assert.NotNil(t, meta.Routes[0].JwtTokenAuth)
	})

	t.Run("converts extensions", func(t *testing.T) {
		jsonData := plugins.JSONData{
			ID:   "test-plugin",
			Name: "Test Plugin",
			Type: plugins.TypeApp,
			Extensions: plugins.Extensions{
				AddedLinks:        []plugins.AddedLink{{Targets: []string{"target1"}, Title: "Link 1", Description: "Description 1"}},
				AddedComponents:   []plugins.AddedComponent{{Targets: []string{"target2"}, Title: "Component 1", Description: "Description 2"}},
				AddedFunctions:    []plugins.AddedFunction{{Targets: []string{"target3"}, Title: "Function 1", Description: "Description 3"}},
				ExposedComponents: []plugins.ExposedComponent{{Id: "comp1", Title: "Component 1", Description: "Description 4"}},
				ExtensionPoints:   []plugins.ExtensionPoint{{Id: "point1", Title: "Point 1", Description: "Description 5"}},
			},
		}

		meta := jsonDataToMetaJSONData(jsonData)
		assert.Len(t, meta.Extensions.AddedLinks, 1)
		assert.Len(t, meta.Extensions.AddedComponents, 1)
		assert.Len(t, meta.Extensions.AddedFunctions, 1)
		assert.Len(t, meta.Extensions.ExposedComponents, 1)
		assert.Len(t, meta.Extensions.ExtensionPoints, 1)
	})

	t.Run("converts roles and IAM", func(t *testing.T) {
		jsonData := plugins.JSONData{
			ID:   "test-plugin",
			Name: "Test Plugin",
			Type: plugins.TypeApp,
			Roles: []plugins.RoleRegistration{
				{
					Grants: []string{"grant1", "grant2"},
					Role: plugins.Role{
						Name:        "Test Role",
						Description: "Test Description",
						Permissions: []plugins.Permission{
							{Action: "read", Scope: "plugins:*"},
							{Action: "write", Scope: "plugins:test"},
						},
					},
				},
			},
			IAM: &auth.IAM{
				Permissions: []auth.Permission{
					{Action: "read", Scope: "plugins:*"},
					{Action: "write", Scope: "plugins:test"},
				},
			},
			Languages: []string{"en", "fr", "de"},
		}

		meta := jsonDataToMetaJSONData(jsonData)
		assert.Len(t, meta.Roles, 1)
		assert.Equal(t, []string{"grant1", "grant2"}, meta.Roles[0].Grants)
		assert.Len(t, meta.Roles[0].Role.Permissions, 2)
		assert.Len(t, meta.Iam.Permissions, 2)
		assert.Equal(t, []string{"en", "fr", "de"}, meta.Languages)
	})
}

func TestPluginStorePluginToMeta(t *testing.T) {
	t.Run("converts core plugin with all fields", func(t *testing.T) {
		plugin := pluginstore.Plugin{
			JSONData: plugins.JSONData{
				ID:   "test-plugin",
				Name: "Test Plugin",
				Type: plugins.TypeDataSource,
			},
			Class:           plugins.ClassCore,
			Module:          "module.js",
			BaseURL:         "https://example.com",
			Signature:       plugins.SignatureStatusValid,
			SignatureType:   plugins.SignatureTypeGrafana,
			SignatureOrg:    "grafana",
			LoadingStrategy: plugins.LoadingStrategyFetch,
			Children:        []string{"child1", "child2"},
			Translations:    map[string]string{"en": "https://example.com/locales/en.json"},
		}

		meta := pluginStorePluginToMeta(plugin, "abc123")
		assert.Equal(t, pluginsv0alpha1.MetaSpecClassCore, meta.Class)
		assert.Equal(t, "module.js", meta.Module.Path)
		assert.Equal(t, "abc123", *meta.Module.Hash)
		assert.Equal(t, pluginsv0alpha1.MetaV0alpha1SpecModuleLoadingStrategyFetch, meta.Module.LoadingStrategy)
		assert.Equal(t, "https://example.com", meta.BaseURL)
		assert.Equal(t, pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusValid, meta.Signature.Status)
		assert.Equal(t, pluginsv0alpha1.MetaV0alpha1SpecSignatureTypeGrafana, *meta.Signature.Type)
		assert.Equal(t, "grafana", *meta.Signature.Org)
		assert.Equal(t, []string{"child1", "child2"}, meta.Children)
		assert.Equal(t, map[string]string{"en": "https://example.com/locales/en.json"}, meta.Translations)
	})

	t.Run("converts external plugin without optional fields", func(t *testing.T) {
		plugin := pluginstore.Plugin{
			JSONData: plugins.JSONData{ID: "test-plugin", Name: "Test Plugin", Type: plugins.TypePanel},
			Class:    plugins.ClassExternal,
		}
		meta := pluginStorePluginToMeta(plugin, "")
		assert.Equal(t, pluginsv0alpha1.MetaSpecClassExternal, meta.Class)
		assert.Empty(t, meta.Module.Path)
		assert.Empty(t, meta.BaseURL)
		assert.Empty(t, meta.Signature.Status)
	})

	t.Run("converts script loading strategy", func(t *testing.T) {
		plugin := pluginstore.Plugin{
			JSONData:        plugins.JSONData{ID: "test-plugin", Name: "Test Plugin", Type: plugins.TypePanel},
			Class:           plugins.ClassExternal,
			Module:          "module.js",
			LoadingStrategy: plugins.LoadingStrategyScript,
		}
		meta := pluginStorePluginToMeta(plugin, "")
		assert.Equal(t, "module.js", meta.Module.Path)
		assert.Equal(t, pluginsv0alpha1.MetaV0alpha1SpecModuleLoadingStrategyScript, meta.Module.LoadingStrategy)
	})
}

func TestConvertSignatureStatus(t *testing.T) {
	testCases := []struct {
		name     string
		status   plugins.SignatureStatus
		expected pluginsv0alpha1.MetaV0alpha1SpecSignatureStatus
	}{
		{"internal", plugins.SignatureStatusInternal, pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusInternal},
		{"valid", plugins.SignatureStatusValid, pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusValid},
		{"invalid", plugins.SignatureStatusInvalid, pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusInvalid},
		{"modified", plugins.SignatureStatusModified, pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusModified},
		{"unsigned", plugins.SignatureStatusUnsigned, pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusUnsigned},
		{"unknown", plugins.SignatureStatus("unknown"), pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusUnsigned},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := convertSignatureStatus(tc.status)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestConvertSignatureType(t *testing.T) {
	testCases := []struct {
		name     string
		sigType  plugins.SignatureType
		expected pluginsv0alpha1.MetaV0alpha1SpecSignatureType
	}{
		{"grafana", plugins.SignatureTypeGrafana, pluginsv0alpha1.MetaV0alpha1SpecSignatureTypeGrafana},
		{"commercial", plugins.SignatureTypeCommercial, pluginsv0alpha1.MetaV0alpha1SpecSignatureTypeCommercial},
		{"community", plugins.SignatureTypeCommunity, pluginsv0alpha1.MetaV0alpha1SpecSignatureTypeCommunity},
		{"private", plugins.SignatureTypePrivate, pluginsv0alpha1.MetaV0alpha1SpecSignatureTypePrivate},
		{"private-glob", plugins.SignatureTypePrivateGlob, pluginsv0alpha1.MetaV0alpha1SpecSignatureTypePrivateGlob},
		{"unknown", plugins.SignatureType("unknown"), pluginsv0alpha1.MetaV0alpha1SpecSignatureTypeGrafana},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := convertSignatureType(tc.sigType)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestPluginToMetaSpec(t *testing.T) {
	t.Run("converts core plugin with all fields", func(t *testing.T) {
		plugin := &plugins.Plugin{
			JSONData:      plugins.JSONData{ID: "test-plugin", Name: "Test Plugin", Type: plugins.TypeDataSource},
			Class:         plugins.ClassCore,
			Module:        "module.js",
			BaseURL:       "https://example.com",
			Signature:     plugins.SignatureStatusValid,
			SignatureType: plugins.SignatureTypeGrafana,
			SignatureOrg:  "grafana",
			Children: []*plugins.Plugin{
				{JSONData: plugins.JSONData{ID: "child1"}},
				{JSONData: plugins.JSONData{ID: "child2"}},
			},
			Translations: map[string]string{"en": "https://example.com/locales/en.json"},
		}

		meta := pluginToMetaSpec(plugin)
		assert.Equal(t, pluginsv0alpha1.MetaSpecClassCore, meta.Class)
		assert.Equal(t, "module.js", meta.Module.Path)
		assert.Equal(t, pluginsv0alpha1.MetaV0alpha1SpecModuleLoadingStrategyScript, meta.Module.LoadingStrategy)
		assert.Equal(t, "https://example.com", meta.BaseURL)
		assert.Equal(t, pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusValid, meta.Signature.Status)
		assert.Equal(t, pluginsv0alpha1.MetaV0alpha1SpecSignatureTypeGrafana, *meta.Signature.Type)
		assert.Equal(t, "grafana", *meta.Signature.Org)
		assert.Equal(t, []string{"child1", "child2"}, meta.Children)
		assert.Equal(t, map[string]string{"en": "https://example.com/locales/en.json"}, meta.Translations)
	})

	t.Run("converts external plugin without optional fields", func(t *testing.T) {
		plugin := &plugins.Plugin{
			JSONData: plugins.JSONData{ID: "test-plugin", Name: "Test Plugin", Type: plugins.TypePanel},
			Class:    plugins.ClassExternal,
		}

		meta := pluginToMetaSpec(plugin)
		assert.Equal(t, pluginsv0alpha1.MetaSpecClassExternal, meta.Class)
		assert.Empty(t, meta.Module.Path)
		assert.Empty(t, meta.BaseURL)
		assert.Equal(t, pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusUnsigned, meta.Signature.Status)
		assert.Nil(t, meta.Signature.Type)
		assert.Nil(t, meta.Signature.Org)
		assert.Empty(t, meta.Children)
		assert.Empty(t, meta.Translations)
	})
}

func TestGrafanaComChildPluginVersionToMetaSpec(t *testing.T) {
	t.Run("converts child plugin version", func(t *testing.T) {
		parent := grafanaComPluginVersionMeta{
			PluginSlug:          "parent-plugin",
			Version:             "1.0.0",
			SignatureType:       "grafana",
			SignedByOrg:         "grafana",
			SignedByOrgName:     "Grafana Labs",
			CDNURL:              "https://cdn.grafana.com",
			CreatePluginVersion: "2023-01-01",
			Manifest: grafanaComPluginManifest{
				Files: map[string]string{"child-plugin/module.js": "hash123"},
			},
		}

		child := grafanaComChildPluginVersion{
			Slug: "child-plugin",
			Path: "child-plugin",
			JSON: pluginsv0alpha1.MetaJSONData{Id: "child-plugin", Name: "Child Plugin"},
		}

		meta, err := grafanaComChildPluginVersionToMetaSpec(&logging.NoOpLogger{}, child, parent)
		require.NoError(t, err)

		assert.Equal(t, "child-plugin", meta.PluginJson.Id)
		assert.Equal(t, pluginsv0alpha1.MetaSpecClassExternal, meta.Class)
		assert.Equal(t, pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusValid, meta.Signature.Status)
	})
}

func TestGrafanaComPluginVersionMetaToMetaSpec(t *testing.T) {
	t.Run("converts plugin version meta with all fields", func(t *testing.T) {
		gcomMeta := grafanaComPluginVersionMeta{
			PluginSlug:          "test-plugin",
			Version:             "1.0.0",
			JSON:                pluginsv0alpha1.MetaJSONData{Id: "test-plugin", Name: "Test Plugin"},
			SignatureType:       "grafana",
			SignedByOrg:         "grafana",
			CDNURL:              "https://cdn.grafana.com/plugins/test-plugin/1.0.0",
			CreatePluginVersion: "2023-01-01",
			Manifest: grafanaComPluginManifest{
				Files: map[string]string{"test-plugin/module.js": "hash123"},
			},
			Children: []grafanaComChildPluginVersion{
				{Slug: "child1"},
				{Slug: "child2"},
			},
		}

		meta, err := grafanaComPluginVersionMetaToMetaSpec(&logging.NoOpLogger{}, gcomMeta, "test-plugin")
		require.NoError(t, err)
		assert.Equal(t, "test-plugin", meta.PluginJson.Id)
		assert.Equal(t, pluginsv0alpha1.MetaSpecClassExternal, meta.Class)
		assert.Equal(t, pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusValid, meta.Signature.Status)
		assert.Equal(t, pluginsv0alpha1.MetaV0alpha1SpecSignatureTypeGrafana, *meta.Signature.Type)
		assert.Equal(t, "grafana", *meta.Signature.Org)
		assert.Equal(t, "https://cdn.grafana.com/plugins/test-plugin/1.0.0/module.js", meta.Module.Path)
		assert.Equal(t, "hash123", *meta.Module.Hash)
		assert.Equal(t, "https://cdn.grafana.com/plugins/test-plugin/1.0.0", meta.BaseURL)
		assert.Equal(t, []string{"child1", "child2"}, meta.Children)
	})

	t.Run("converts all signature types", func(t *testing.T) {
		testCases := []struct {
			sigType  string
			expected pluginsv0alpha1.MetaV0alpha1SpecSignatureType
		}{
			{"grafana", pluginsv0alpha1.MetaV0alpha1SpecSignatureTypeGrafana},
			{"commercial", pluginsv0alpha1.MetaV0alpha1SpecSignatureTypeCommercial},
			{"community", pluginsv0alpha1.MetaV0alpha1SpecSignatureTypeCommunity},
			{"private", pluginsv0alpha1.MetaV0alpha1SpecSignatureTypePrivate},
			{"private-glob", pluginsv0alpha1.MetaV0alpha1SpecSignatureTypePrivateGlob},
		}

		for _, tc := range testCases {
			t.Run(tc.sigType, func(t *testing.T) {
				gcomMeta := grafanaComPluginVersionMeta{
					PluginSlug:          "test-plugin",
					Version:             "1.0.0",
					JSON:                pluginsv0alpha1.MetaJSONData{Id: "test-plugin"},
					SignatureType:       tc.sigType,
					CDNURL:              "https://cdn.grafana.com",
					CreatePluginVersion: "2023-01-01",
					Manifest: grafanaComPluginManifest{
						Files: map[string]string{"test-plugin/module.js": "hash123"},
					},
				}

				meta, err := grafanaComPluginVersionMetaToMetaSpec(&logging.NoOpLogger{}, gcomMeta, "test-plugin")
				require.NoError(t, err)
				require.NotNil(t, meta.Signature.Type)
				assert.Equal(t, tc.expected, *meta.Signature.Type)
			})
		}
	})

	t.Run("handles missing module hash gracefully", func(t *testing.T) {
		gcomMeta := grafanaComPluginVersionMeta{
			PluginSlug:          "test-plugin",
			Version:             "1.0.0",
			JSON:                pluginsv0alpha1.MetaJSONData{Id: "test-plugin"},
			CDNURL:              "https://cdn.grafana.com",
			CreatePluginVersion: "2023-01-01",
			Manifest: grafanaComPluginManifest{
				Files: map[string]string{},
			},
		}

		meta, err := grafanaComPluginVersionMetaToMetaSpec(&logging.NoOpLogger{}, gcomMeta, "test-plugin")
		require.NoError(t, err)
		require.NotNil(t, meta.Module)
		assert.Nil(t, meta.Module.Hash)
	})
}

func TestTranslationsFromManifest(t *testing.T) {
	t.Run("builds translations from manifest", func(t *testing.T) {
		cdnURL := "https://cdn.grafana.com"
		pluginRelBasePath := "test-plugin"
		manifestFiles := map[string]string{
			"test-plugin/locales/en/test-plugin.json": "hash1",
			"test-plugin/locales/fr/test-plugin.json": "hash2",
		}
		jsonData := pluginsv0alpha1.MetaJSONData{Id: "test-plugin", Languages: []string{"en", "fr"}}

		translations, err := translationsFromManifest(cdnURL, manifestFiles, pluginRelBasePath, jsonData)

		require.NoError(t, err)
		assert.Len(t, translations, 2)
		assert.Equal(t, "https://cdn.grafana.com/test-plugin/locales/en/test-plugin.json", translations["en"])
		assert.Equal(t, "https://cdn.grafana.com/test-plugin/locales/fr/test-plugin.json", translations["fr"])
	})

	t.Run("skips missing translation files", func(t *testing.T) {
		cdnURL := "https://cdn.grafana.com"
		pluginRelBasePath := "test-plugin"
		manifestFiles := map[string]string{"test-plugin/locales/en/test-plugin.json": "hash1"}
		jsonData := pluginsv0alpha1.MetaJSONData{Id: "test-plugin", Languages: []string{"en", "fr"}}

		translations, err := translationsFromManifest(cdnURL, manifestFiles, pluginRelBasePath, jsonData)
		require.NoError(t, err)
		assert.Len(t, translations, 1)
		assert.Contains(t, translations, "en")
		assert.NotContains(t, translations, "fr")
	})

	t.Run("returns empty map when no languages", func(t *testing.T) {
		cdnURL := "https://cdn.grafana.com"
		pluginRelBasePath := "test-plugin"
		manifestFiles := map[string]string{}
		jsonData := pluginsv0alpha1.MetaJSONData{Id: "test-plugin", Languages: []string{}}

		translations, err := translationsFromManifest(cdnURL, manifestFiles, pluginRelBasePath, jsonData)
		require.NoError(t, err)
		assert.Empty(t, translations)
	})
}

func TestCalculateLoadingStrategyFromGcomMeta(t *testing.T) {
	t.Run("returns script for compatible versions", func(t *testing.T) {
		createPluginVersion := "2020-01-01"
		if pluginassets.ScriptLoadingCompatible(createPluginVersion) {
			strategy := calculateLoadingStrategyFromGcomMeta(createPluginVersion)
			assert.Equal(t, pluginsv0alpha1.MetaV0alpha1SpecModuleLoadingStrategyScript, strategy)
		}
	})

	t.Run("returns fetch for incompatible versions", func(t *testing.T) {
		createPluginVersion := "2099-01-01"
		if !pluginassets.ScriptLoadingCompatible(createPluginVersion) {
			strategy := calculateLoadingStrategyFromGcomMeta(createPluginVersion)
			assert.Equal(t, pluginsv0alpha1.MetaV0alpha1SpecModuleLoadingStrategyFetch, strategy)
		}
	})

	t.Run("defaults to fetch for empty version", func(t *testing.T) {
		strategy := calculateLoadingStrategyFromGcomMeta("")
		assert.Equal(t, pluginsv0alpha1.MetaV0alpha1SpecModuleLoadingStrategyFetch, strategy)
	})
}
