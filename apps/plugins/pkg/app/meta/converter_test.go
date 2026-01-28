package meta

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/auth"
)

func TestJsonDataToMetaJSONData(t *testing.T) {
	t.Run("handles optional fields", func(t *testing.T) {
		jsonData := plugins.JSONData{
			ID:   "test-plugin",
			Name: "Test Plugin",
			Type: plugins.TypePanel,
			Info: plugins.Info{
				Version: "1.0.0",
			},
		}

		meta := jsonDataToMetaJSONData(jsonData)

		assert.Nil(t, meta.Info.Description)
		assert.Nil(t, meta.Info.Author)
		assert.Empty(t, meta.Info.Keywords)
	})

	t.Run("round-trip conversion preserves data", func(t *testing.T) {
		original := testJSONData()

		// Convert to meta and back
		meta := jsonDataToMetaJSONData(original)
		converted := metaJSONDataToJSONData(meta)

		assert.Equal(t, original.ID, converted.ID)
		assert.Equal(t, original.Name, converted.Name)
		assert.Equal(t, original.Type, converted.Type)
		assert.Equal(t, original.Info.Version, converted.Info.Version)
		assert.Equal(t, original.Info.Description, converted.Info.Description)
		assert.Equal(t, original.Info.Keywords, converted.Info.Keywords)
		assert.Equal(t, original.Info.Logos.Small, converted.Info.Logos.Small)
		assert.Equal(t, original.Info.Logos.Large, converted.Info.Logos.Large)
		assert.Equal(t, original.Info.Author.Name, converted.Info.Author.Name)
		assert.Equal(t, original.Info.Author.URL, converted.Info.Author.URL)
		assert.Equal(t, len(original.Info.Links), len(converted.Info.Links))
		if len(original.Info.Links) > 0 {
			assert.Equal(t, original.Info.Links[0].Name, converted.Info.Links[0].Name)
			assert.Equal(t, original.Info.Links[0].URL, converted.Info.Links[0].URL)
		}
		assert.Equal(t, len(original.Info.Screenshots), len(converted.Info.Screenshots))
		if len(original.Info.Screenshots) > 0 {
			assert.Equal(t, original.Info.Screenshots[0].Name, converted.Info.Screenshots[0].Name)
			assert.Equal(t, original.Info.Screenshots[0].Path, converted.Info.Screenshots[0].Path)
		}

		assert.Equal(t, original.Dependencies.GrafanaDependency, converted.Dependencies.GrafanaDependency)
		assert.Equal(t, original.Dependencies.GrafanaVersion, converted.Dependencies.GrafanaVersion)
		assert.Equal(t, len(original.Dependencies.Plugins), len(converted.Dependencies.Plugins))
		if len(original.Dependencies.Plugins) > 0 {
			assert.Equal(t, original.Dependencies.Plugins[0].ID, converted.Dependencies.Plugins[0].ID)
			assert.Equal(t, original.Dependencies.Plugins[0].Type, converted.Dependencies.Plugins[0].Type)
			assert.Equal(t, original.Dependencies.Plugins[0].Name, converted.Dependencies.Plugins[0].Name)
		}
		assert.Equal(t, original.Dependencies.Extensions.ExposedComponents, converted.Dependencies.Extensions.ExposedComponents)

		assert.Equal(t, len(original.Includes), len(converted.Includes))
		if len(original.Includes) > 0 && len(converted.Includes) > 0 {
			assert.Equal(t, original.Includes[0].Name, converted.Includes[0].Name)
			assert.Equal(t, original.Includes[0].Path, converted.Includes[0].Path)
			assert.Equal(t, original.Includes[0].Type, converted.Includes[0].Type)
			assert.Equal(t, original.Includes[0].UID, converted.Includes[0].UID)
			assert.Equal(t, original.Includes[0].Icon, converted.Includes[0].Icon)
			assert.Equal(t, original.Includes[0].Role, converted.Includes[0].Role)
			assert.Equal(t, original.Includes[0].Action, converted.Includes[0].Action)
			assert.Equal(t, original.Includes[0].AddToNav, converted.Includes[0].AddToNav)
			assert.Equal(t, original.Includes[0].DefaultNav, converted.Includes[0].DefaultNav)
		}

		assert.Equal(t, len(original.Routes), len(converted.Routes))
		if len(original.Routes) > 0 && len(converted.Routes) > 0 {
			assert.Equal(t, original.Routes[0].Path, converted.Routes[0].Path)
			assert.Equal(t, original.Routes[0].Method, converted.Routes[0].Method)
			assert.Equal(t, original.Routes[0].URL, converted.Routes[0].URL)
			assert.Equal(t, original.Routes[0].ReqRole, converted.Routes[0].ReqRole)
			assert.Equal(t, original.Routes[0].ReqAction, converted.Routes[0].ReqAction)
			assert.Equal(t, len(original.Routes[0].Headers), len(converted.Routes[0].Headers))
			if len(original.Routes[0].Headers) > 0 {
				assert.Equal(t, original.Routes[0].Headers[0].Name, converted.Routes[0].Headers[0].Name)
				assert.Equal(t, original.Routes[0].Headers[0].Content, converted.Routes[0].Headers[0].Content)
			}
			assert.Equal(t, len(original.Routes[0].URLParams), len(converted.Routes[0].URLParams))
			if len(original.Routes[0].URLParams) > 0 {
				assert.Equal(t, original.Routes[0].URLParams[0].Name, converted.Routes[0].URLParams[0].Name)
				assert.Equal(t, original.Routes[0].URLParams[0].Content, converted.Routes[0].URLParams[0].Content)
			}
			if original.Routes[0].TokenAuth != nil {
				assert.NotNil(t, converted.Routes[0].TokenAuth)
				assert.Equal(t, original.Routes[0].TokenAuth.Url, converted.Routes[0].TokenAuth.Url)
				assert.Equal(t, original.Routes[0].TokenAuth.Scopes, converted.Routes[0].TokenAuth.Scopes)
			}
		}

		assert.Equal(t, len(original.Extensions.AddedLinks), len(converted.Extensions.AddedLinks))
		if len(original.Extensions.AddedLinks) > 0 {
			assert.Equal(t, original.Extensions.AddedLinks[0].Targets, converted.Extensions.AddedLinks[0].Targets)
			assert.Equal(t, original.Extensions.AddedLinks[0].Title, converted.Extensions.AddedLinks[0].Title)
			assert.Equal(t, original.Extensions.AddedLinks[0].Description, converted.Extensions.AddedLinks[0].Description)
		}
		assert.Equal(t, len(original.Extensions.AddedComponents), len(converted.Extensions.AddedComponents))
		assert.Equal(t, len(original.Extensions.ExposedComponents), len(converted.Extensions.ExposedComponents))
		if len(original.Extensions.ExposedComponents) > 0 {
			assert.Equal(t, original.Extensions.ExposedComponents[0].Id, converted.Extensions.ExposedComponents[0].Id)
			assert.Equal(t, original.Extensions.ExposedComponents[0].Title, converted.Extensions.ExposedComponents[0].Title)
			assert.Equal(t, original.Extensions.ExposedComponents[0].Description, converted.Extensions.ExposedComponents[0].Description)
		}
		assert.Equal(t, len(original.Extensions.ExtensionPoints), len(converted.Extensions.ExtensionPoints))
		assert.Equal(t, len(original.Extensions.AddedFunctions), len(converted.Extensions.AddedFunctions))

		assert.Equal(t, len(original.Roles), len(converted.Roles))
		if len(original.Roles) > 0 && len(converted.Roles) > 0 {
			assert.Equal(t, original.Roles[0].Grants, converted.Roles[0].Grants)
			assert.Equal(t, original.Roles[0].Role.Name, converted.Roles[0].Role.Name)
			assert.Equal(t, original.Roles[0].Role.Description, converted.Roles[0].Role.Description)
			assert.Equal(t, len(original.Roles[0].Role.Permissions), len(converted.Roles[0].Role.Permissions))
			if len(original.Roles[0].Role.Permissions) > 0 {
				assert.Equal(t, original.Roles[0].Role.Permissions[0].Action, converted.Roles[0].Role.Permissions[0].Action)
				assert.Equal(t, original.Roles[0].Role.Permissions[0].Scope, converted.Roles[0].Role.Permissions[0].Scope)
			}
		}

		if original.IAM != nil {
			assert.NotNil(t, converted.IAM)
			assert.Equal(t, len(original.IAM.Permissions), len(converted.IAM.Permissions))
			if len(original.IAM.Permissions) > 0 {
				assert.Equal(t, original.IAM.Permissions[0].Action, converted.IAM.Permissions[0].Action)
				assert.Equal(t, original.IAM.Permissions[0].Scope, converted.IAM.Permissions[0].Scope)
			}
		}

		assert.Equal(t, original.Alerting, converted.Alerting)
		assert.Equal(t, original.Annotations, converted.Annotations)
		assert.Equal(t, original.Metrics, converted.Metrics)
		assert.Equal(t, original.Logs, converted.Logs)
		assert.Equal(t, original.Tracing, converted.Tracing)
		assert.Equal(t, original.Backend, converted.Backend)
		assert.Equal(t, original.Streaming, converted.Streaming)
		assert.Equal(t, original.Category, converted.Category)
		assert.Equal(t, original.State, converted.State)
		assert.Equal(t, original.Executable, converted.Executable)
		assert.Equal(t, len(original.QueryOptions), len(converted.QueryOptions))
		if len(original.QueryOptions) > 0 {
			assert.Equal(t, original.QueryOptions["maxDataPoints"], converted.QueryOptions["maxDataPoints"])
			assert.Equal(t, original.QueryOptions["minInterval"], converted.QueryOptions["minInterval"])
		}
	})
}

func TestMetaJSONDataToJSONData(t *testing.T) {
	t.Run("handles optional fields", func(t *testing.T) {
		meta := pluginsv0alpha1.MetaJSONData{
			Id:   "test-plugin",
			Name: "Test Plugin",
			Type: pluginsv0alpha1.MetaJSONDataTypePanel,
			Info: pluginsv0alpha1.MetaInfo{
				Version: "1.0.0",
			},
		}

		jsonData := metaJSONDataToJSONData(meta)
		assert.Empty(t, jsonData.Info.Description)
		assert.Empty(t, jsonData.Info.Author.Name)
		assert.Empty(t, jsonData.Info.Keywords)
	})
}

// testJSONData creates a JSONData struct with all fields populated for testing.
func testJSONData() plugins.JSONData {
	return plugins.JSONData{
		ID:   "test-plugin",
		Name: "Test Plugin",
		Type: plugins.TypeApp,
		Info: plugins.Info{
			Version:     "1.0.0",
			Description: "Test description",
			Keywords:    []string{"test", "plugin"},
			Logos: plugins.Logos{
				Small: "small.png",
				Large: "large.png",
			},
			Author: plugins.InfoLink{
				Name: "Test Author",
				URL:  "https://example.com",
			},
			Links: []plugins.InfoLink{
				{Name: "Link 1", URL: "https://example.com/link1"},
				{Name: "Link 2", URL: "https://example.com/link2"},
			},
			Screenshots: []plugins.Screenshots{
				{Name: "Screenshot 1", Path: "screenshot1.png"},
				{Name: "Screenshot 2", Path: "screenshot2.png"},
			},
		},
		Dependencies: plugins.Dependencies{
			GrafanaDependency: ">=8.0.0",
			GrafanaVersion:    ">=8.0.0",
			Plugins: []plugins.Dependency{
				{ID: "plugin1", Type: "datasource", Name: "Plugin 1"},
				{ID: "plugin2", Type: "panel", Name: "Plugin 2"},
			},
			Extensions: plugins.ExtensionsDependencies{
				ExposedComponents: []string{"component1", "component2"},
			},
		},
		Category:   "cloud",
		State:      plugins.ReleaseStateBeta,
		Executable: "plugin",
		QueryOptions: map[string]bool{
			"maxDataPoints": true,
			"minInterval":   true,
		},
		Includes: []*plugins.Includes{
			{
				Name:       "Dashboard 1",
				Path:       "/d/dashboard1",
				Type:       "dashboard",
				UID:        "dashboard1",
				Icon:       "dashboard",
				Role:       identity.RoleViewer,
				Action:     "dashboards:read",
				AddToNav:   true,
				DefaultNav: true,
			},
		},
		Routes: []*plugins.Route{
			{
				Path:      "/api/query",
				Method:    "POST",
				URL:       "https://api.example.com/query",
				ReqRole:   identity.RoleEditor,
				ReqAction: "datasources:query",
				Headers: []plugins.Header{
					{Name: "X-Custom-Header", Content: "value"},
				},
				URLParams: []plugins.URLParam{
					{Name: "param1", Content: "value1"},
				},
				TokenAuth: &plugins.JWTTokenAuth{
					Url:    "https://auth.example.com/token",
					Scopes: []string{"read", "write"},
					Params: map[string]string{
						"param1": "value1",
					},
				},
				Body: []byte(`{"key": "value"}`),
			},
		},
		Extensions: plugins.Extensions{
			AddedLinks: []plugins.AddedLink{
				{Targets: []string{"target1"}, Title: "Link Title", Description: "Link Description"},
			},
			AddedComponents: []plugins.AddedComponent{
				{Targets: []string{"target2"}, Title: "Component Title", Description: "Component Description"},
			},
			ExposedComponents: []plugins.ExposedComponent{
				{Id: "exposed1", Title: "Exposed 1", Description: "Description 1"},
			},
			ExtensionPoints: []plugins.ExtensionPoint{
				{Id: "point1", Title: "Point 1", Description: "Point Description"},
			},
			AddedFunctions: []plugins.AddedFunction{
				{Targets: []string{"target3"}, Title: "Function Title", Description: "Function Description"},
			},
		},
		Roles: []plugins.RoleRegistration{
			{
				Grants: []string{"grant1", "grant2"},
				Role: plugins.Role{
					Name:        "Custom Role",
					Description: "Role Description",
					Permissions: []plugins.Permission{
						{Action: "action1", Scope: "scope1"},
						{Action: "action2", Scope: "scope2"},
					},
				},
			},
		},
		IAM: &auth.IAM{
			Permissions: []auth.Permission{
				{Action: "iam:action1", Scope: "iam:scope1"},
				{Action: "iam:action2", Scope: "iam:scope2"},
			},
		},
		Alerting:    true,
		Annotations: true,
		Metrics:     true,
		Logs:        true,
		Tracing:     true,
		Backend:     true,
		Streaming:   true,
	}
}

func TestPluginToMetaSpec(t *testing.T) {
	t.Run("comprehensive conversion with all fields populated", func(t *testing.T) {
		plugin := &plugins.Plugin{
			JSONData:        testJSONData(),
			Class:           plugins.ClassExternal,
			Module:          "module.js",
			LoadingStrategy: plugins.LoadingStrategyFetch,
			BaseURL:         "https://example.com/plugin",
			Signature:       plugins.SignatureStatusValid,
			SignatureType:   plugins.SignatureTypeCommercial,
			SignatureOrg:    "example-org",
			Children: []*plugins.Plugin{
				{JSONData: plugins.JSONData{ID: "child1"}},
				{JSONData: plugins.JSONData{ID: "child2"}},
			},
			Translations: map[string]string{
				"en": "en.json",
				"fr": "fr.json",
			},
		}

		metaSpec := pluginToMetaSpec(plugin)

		assert.Equal(t, "test-plugin", metaSpec.PluginJson.Id)
		assert.Equal(t, "Test Plugin", metaSpec.PluginJson.Name)
		assert.Equal(t, pluginsv0alpha1.MetaJSONDataTypeApp, metaSpec.PluginJson.Type)
		assert.Equal(t, pluginsv0alpha1.MetaSpecClassExternal, metaSpec.Class)
		require.NotNil(t, metaSpec.Module)
		assert.Equal(t, "module.js", metaSpec.Module.Path)
		require.NotNil(t, metaSpec.Module.LoadingStrategy)
		assert.Equal(t, pluginsv0alpha1.MetaV0alpha1SpecModuleLoadingStrategyFetch, *metaSpec.Module.LoadingStrategy)
		require.NotNil(t, metaSpec.BaseURL)
		assert.Equal(t, "https://example.com/plugin", *metaSpec.BaseURL)
		require.NotNil(t, metaSpec.Signature)
		assert.Equal(t, pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusValid, metaSpec.Signature.Status)
		require.NotNil(t, metaSpec.Signature.Type)
		assert.Equal(t, pluginsv0alpha1.MetaV0alpha1SpecSignatureTypeCommercial, *metaSpec.Signature.Type)
		require.NotNil(t, metaSpec.Signature.Org)
		assert.Equal(t, "example-org", *metaSpec.Signature.Org)
		require.Len(t, metaSpec.Children, 2)
		assert.Equal(t, "child1", metaSpec.Children[0])
		assert.Equal(t, "child2", metaSpec.Children[1])
		require.Len(t, metaSpec.Translations, 2)
		assert.Equal(t, "en.json", metaSpec.Translations["en"])
		assert.Equal(t, "fr.json", metaSpec.Translations["fr"])
	})

	t.Run("converts all Class, LoadingStrategy, SignatureType, and SignatureStatus variants", func(t *testing.T) {
		testCases := []struct {
			name            string
			class           plugins.Class
			loadingStrategy plugins.LoadingStrategy
			signatureType   plugins.SignatureType
			signatureStatus plugins.SignatureStatus
			expectedClass   pluginsv0alpha1.MetaSpecClass
			expectedLS      *pluginsv0alpha1.MetaV0alpha1SpecModuleLoadingStrategy
			expectedSigType *pluginsv0alpha1.MetaV0alpha1SpecSignatureType
			expectedSigStat pluginsv0alpha1.MetaV0alpha1SpecSignatureStatus
		}{
			{
				name:            "Core plugin with Fetch and Grafana signature",
				class:           plugins.ClassCore,
				loadingStrategy: plugins.LoadingStrategyFetch,
				signatureType:   plugins.SignatureTypeGrafana,
				signatureStatus: plugins.SignatureStatusValid,
				expectedClass:   pluginsv0alpha1.MetaSpecClassCore,
				expectedLS:      ptr(pluginsv0alpha1.MetaV0alpha1SpecModuleLoadingStrategyFetch),
				expectedSigType: ptr(pluginsv0alpha1.MetaV0alpha1SpecSignatureTypeGrafana),
				expectedSigStat: pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusValid,
			},
			{
				name:            "External plugin with Script and Commercial signature",
				class:           plugins.ClassExternal,
				loadingStrategy: plugins.LoadingStrategyScript,
				signatureType:   plugins.SignatureTypeCommercial,
				signatureStatus: plugins.SignatureStatusInvalid,
				expectedClass:   pluginsv0alpha1.MetaSpecClassExternal,
				expectedLS:      ptr(pluginsv0alpha1.MetaV0alpha1SpecModuleLoadingStrategyScript),
				expectedSigType: ptr(pluginsv0alpha1.MetaV0alpha1SpecSignatureTypeCommercial),
				expectedSigStat: pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusInvalid,
			},
			{
				name:            "External plugin with Community signature and Modified status",
				class:           plugins.ClassExternal,
				loadingStrategy: plugins.LoadingStrategyFetch,
				signatureType:   plugins.SignatureTypeCommunity,
				signatureStatus: plugins.SignatureStatusModified,
				expectedClass:   pluginsv0alpha1.MetaSpecClassExternal,
				expectedLS:      ptr(pluginsv0alpha1.MetaV0alpha1SpecModuleLoadingStrategyFetch),
				expectedSigType: ptr(pluginsv0alpha1.MetaV0alpha1SpecSignatureTypeCommunity),
				expectedSigStat: pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusModified,
			},
			{
				name:            "External plugin with Private signature and Unsigned status",
				class:           plugins.ClassExternal,
				loadingStrategy: plugins.LoadingStrategyScript,
				signatureType:   plugins.SignatureTypePrivate,
				signatureStatus: plugins.SignatureStatusUnsigned,
				expectedClass:   pluginsv0alpha1.MetaSpecClassExternal,
				expectedLS:      ptr(pluginsv0alpha1.MetaV0alpha1SpecModuleLoadingStrategyScript),
				expectedSigType: ptr(pluginsv0alpha1.MetaV0alpha1SpecSignatureTypePrivate),
				expectedSigStat: pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusUnsigned,
			},
			{
				name:            "External plugin with PrivateGlob signature and Internal status",
				class:           plugins.ClassExternal,
				loadingStrategy: plugins.LoadingStrategyFetch,
				signatureType:   plugins.SignatureTypePrivateGlob,
				signatureStatus: plugins.SignatureStatusInternal,
				expectedClass:   pluginsv0alpha1.MetaSpecClassExternal,
				expectedLS:      ptr(pluginsv0alpha1.MetaV0alpha1SpecModuleLoadingStrategyFetch),
				expectedSigType: ptr(pluginsv0alpha1.MetaV0alpha1SpecSignatureTypePrivateGlob),
				expectedSigStat: pluginsv0alpha1.MetaV0alpha1SpecSignatureStatusInternal,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				plugin := &plugins.Plugin{
					JSONData:        plugins.JSONData{ID: "test-plugin", Name: "Test Plugin", Type: plugins.TypeDataSource},
					Class:           tc.class,
					Module:          "module.js",
					LoadingStrategy: tc.loadingStrategy,
					BaseURL:         "https://example.com/plugin",
					Signature:       tc.signatureStatus,
					SignatureType:   tc.signatureType,
					SignatureOrg:    "test-org",
				}

				metaSpec := pluginToMetaSpec(plugin)

				assert.Equal(t, tc.expectedClass, metaSpec.Class)
				require.NotNil(t, metaSpec.Module)
				if tc.expectedLS != nil {
					require.NotNil(t, metaSpec.Module.LoadingStrategy)
					assert.Equal(t, *tc.expectedLS, *metaSpec.Module.LoadingStrategy)
				}
				require.NotNil(t, metaSpec.Signature)
				assert.Equal(t, tc.expectedSigStat, metaSpec.Signature.Status)
				if tc.expectedSigType != nil {
					require.NotNil(t, metaSpec.Signature.Type)
					assert.Equal(t, *tc.expectedSigType, *metaSpec.Signature.Type)
				}
			})
		}
	})
}

func ptr[T any](v T) *T {
	return &v
}
