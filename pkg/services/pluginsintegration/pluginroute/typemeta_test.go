package pluginroute

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/plugins/definition"
)

func TestWithTypeMeta(t *testing.T) {
	gvk := schema.GroupVersionKind{Group: "example.ext.grafana.app", Version: "v1alpha1", Kind: "TestKind"}
	for _, tc := range []struct {
		name, in, want string
	}{
		{"both missing", `{"spec":{"a":1}}`,
			`{"apiVersion":"example.ext.grafana.app/v1alpha1","kind":"TestKind","spec":{"a":1}}`},
		{"kind missing", `{"apiVersion":"other/v9","spec":{}}`,
			`{"kind":"TestKind","apiVersion":"other/v9","spec":{}}`},
		{"apiVersion missing", `{"kind":"Other"}`,
			`{"apiVersion":"example.ext.grafana.app/v1alpha1","kind":"Other"}`},
		{"empty object", ` {}`, `{"apiVersion":"example.ext.grafana.app/v1alpha1","kind":"TestKind"}`},
		{"leading whitespace", "\n  {\"spec\":{}}",
			`{"apiVersion":"example.ext.grafana.app/v1alpha1","kind":"TestKind","spec":{}}`},
		{"both present", `{"apiVersion":"a/b","kind":"K"}`, `{"apiVersion":"a/b","kind":"K"}`},
		{"empty values are left to the decoder", `{"apiVersion":"","kind":""}`, `{"apiVersion":"","kind":""}`},
		{"not an object", `[1,2]`, `[1,2]`},
		{"null", `null`, `null`},
		{"invalid", `{"spec":`, `{"spec":`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, string(withTypeMeta([]byte(tc.in), gvk)))
		})
	}
}

// typeMetaPlugin serves TestKind outside folders, so a bare body is valid.
func typeMetaPlugin() definition.PluginDefinition {
	plugin := testPlugin()
	folderScoped := false
	plugin.Manifests[0].Versions[0].Kinds[0].FolderScoped = &folderScoped
	return plugin
}

const untypedObjectJSON = `{"metadata":{"name":"example","namespace":"default"},"spec":{"testField":"hello"}}`

func postTestKind(t *testing.T, handler http.Handler, query, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost,
		"/apis/example.ext.grafana.app/v1alpha1/namespaces/default/testkinds"+query, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	return res
}

// A manifest kind can be created without repeating the apiVersion and kind
// the URL already names, as any typed Grafana resource can.
func TestHandlerDefaultsTypeMetaFromTheURL(t *testing.T) {
	for _, tc := range []struct{ name, query string }{
		{"default validation", ""},
		{"strict validation", "?fieldValidation=Strict"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			storage := &resourceClient{}
			opts := allowAll(testOptions())
			opts.Storage = UnifiedStorage(storage, nil, nil)
			handler := withRequester(loadHandler(t, typeMetaPlugin(), opts))

			res := postTestKind(t, handler, tc.query, untypedObjectJSON)
			require.Equal(t, http.StatusCreated, res.Code, res.Body.String())

			var created, stored map[string]any
			require.NoError(t, json.Unmarshal(res.Body.Bytes(), &created))
			require.NoError(t, json.Unmarshal(storage.created.Value, &stored))
			for _, obj := range []map[string]any{created, stored} {
				require.Equal(t, "example.ext.grafana.app/v1alpha1", obj["apiVersion"])
				require.Equal(t, "TestKind", obj["kind"])
				require.Equal(t, "hello", obj["spec"].(map[string]any)["testField"])
			}
		})
	}
}

// Only absent keys are filled, so a body naming another version is still
// rejected rather than silently relabelled.
func TestHandlerKeepsTypeMetaFromTheBody(t *testing.T) {
	opts := allowAll(testOptions())
	opts.Storage = UnifiedStorage(&resourceClient{}, nil, nil)
	handler := withRequester(loadHandler(t, typeMetaPlugin(), opts))

	res := postTestKind(t, handler, "", `{"apiVersion":"example.ext.grafana.app/v9","metadata":{"name":"example"},"spec":{"testField":"hello"}}`)
	require.Equal(t, http.StatusBadRequest, res.Code, res.Body.String())
	require.Contains(t, res.Body.String(), "does not match the expected API version")
}

// Strict validation still sees the body as sent: the defaulting splices keys
// in rather than re-encoding, which would collapse duplicates.
func TestHandlerTypeMetaDefaultingKeepsStrictErrors(t *testing.T) {
	opts := allowAll(testOptions())
	opts.Storage = UnifiedStorage(&resourceClient{}, nil, nil)
	handler := withRequester(loadHandler(t, typeMetaPlugin(), opts))

	res := postTestKind(t, handler, "?fieldValidation=Strict",
		`{"metadata":{"name":"example"},"spec":{"testField":"a","testField":"b"}}`)
	require.Equal(t, http.StatusBadRequest, res.Code, res.Body.String())
	require.Contains(t, res.Body.String(), `duplicate field`)
}
