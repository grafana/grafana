package router

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute/appsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// Read-only settings, as the cloud loader serves them, must be described as
// writable ones are, with only the writes to the settings kind left out: the
// plugin's schema, the instance path and every method of its custom routes.
func TestReadOnlySettingsOpenAPI(t *testing.T) {
	const root = "/apis/example-app/v0alpha1/namespaces/{namespace}/app"
	schema := func() *pluginschema.PluginSchema {
		return &pluginschema.PluginSchema{
			SettingsSchema: &pluginschema.Settings{
				Spec: &spec.Schema{SchemaProps: spec.SchemaProps{
					Type:       []string{"object"},
					Properties: map[string]spec.Schema{"message": *spec.StringProperty()},
				}},
				SecureValues: []pluginschema.SecureValueInfo{{Key: "apiKey", Required: true}},
			},
			SettingsExamples: &pluginschema.SettingsExamples{Examples: map[string]*spec3.Example{
				"default": {ExampleProps: spec3.ExampleProps{Value: map[string]any{"spec": map[string]any{"jsonData": map[string]any{"message": "hello"}}}}},
			}},
			Routes: &pluginschema.Routes{Paths: map[string]*spec3.Path{
				"/resources/things": {PathProps: spec3.PathProps{
					Get:    &spec3.Operation{OperationProps: spec3.OperationProps{Description: "list things"}},
					Post:   &spec3.Operation{OperationProps: spec3.OperationProps{Description: "add a thing"}},
					Delete: &spec3.Operation{OperationProps: spec3.OperationProps{Description: "remove things"}},
				}},
			}},
		}
	}
	docFor := func(t *testing.T, readOnly bool) spec3.OpenAPI {
		t.Helper()
		plugin := definition.PluginDefinition{
			JSONData: plugins.JSONData{ID: "example-app", Type: plugins.TypeApp, Backend: true},
			Schemas:  map[string]*pluginschema.PluginSchema{"v0alpha1": schema()},
		}
		loadSettingsManifest(t.Context(), &plugin)
		allow := func(context.Context, identity.Requester, string) (authorizer.Decision, string, error) {
			return authorizer.DecisionAllow, "", nil
		}
		b, err := newPluginSettingsBackend(plugin, func(context.Context, string) (plugins.Client, appclientv3.Client, error) {
			return struct{ plugins.Client }{}, nil, nil
		}, PluginDependencies{
			DualWrite:       dualwrite.ProvideServiceForTests(nil),
			ContextProvider: cloudPluginContext{},
			Unified:         &resource.MockResourceClient{},
			Settings: SettingsDependencies{
				ReadOnly:      readOnly,
				AccessChecker: allow,
				LegacyStore: func(_ context.Context, id string) (grafanarest.Storage, error) {
					return appsettings.NewLegacySettingsStore(id, id, &pluginsettings.FakePluginSettings{}), nil
				},
			},
		})
		require.NoError(t, err)
		h, err := b.Load(t.Context())
		require.NoError(t, err)
		t.Cleanup(h.(interface{ Destroy() }).Destroy)

		r := httptest.NewRequest(http.MethodGet, "/openapi/v3/apis/example-app/v0alpha1", nil)
		r = r.WithContext(identity.WithRequester(r.Context(), settingsRequester("stacks-1")))
		w := httptest.NewRecorder()
		h.ServeHTTP(newStatusRecorder(w).writer(), r)
		require.Equal(t, http.StatusOK, w.Code, w.Body.String())
		var doc spec3.OpenAPI
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &doc))
		return doc
	}
	methods := func(doc spec3.OpenAPI) map[string][]string {
		out := map[string][]string{}
		for path, item := range doc.Paths.Paths {
			for method, op := range map[string]*spec3.Operation{
				http.MethodGet: item.Get, http.MethodPost: item.Post, http.MethodPut: item.Put,
				http.MethodPatch: item.Patch, http.MethodDelete: item.Delete,
			} {
				if op != nil {
					out[path] = append(out[path], method)
				}
			}
			slices.Sort(out[path])
		}
		return out
	}

	writable, readOnly := docFor(t, false), docFor(t, true)
	want := methods(writable)
	require.Equal(t, []string{"DELETE", "GET", "PATCH", "PUT"}, want[root+"/instance"], "the writable settings kind")
	want[root+"/instance"] = []string{"GET"}
	require.Equal(t, want, methods(readOnly), "only the writes to the settings kind are left out")
	require.Equal(t, []string{"DELETE", "GET", "POST"}, methods(readOnly)[root+"/instance/resources/things"], "custom routes keep every method")
	require.Contains(t, methods(readOnly), root+"/instance/health")

	for _, name := range []string{"SettingsSpec", "SecureValues"} {
		require.Contains(t, readOnly.Components.Schemas, name)
		require.Equal(t, writable.Components.Schemas[name], readOnly.Components.Schemas[name], name)
	}
}
