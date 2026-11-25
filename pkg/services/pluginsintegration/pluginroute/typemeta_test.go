package pluginroute

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"

	"github.com/grafana/grafana/pkg/plugins/definition"
)

func typeMetaSerializer(t *testing.T, mediaType string, strict bool) runtime.Serializer {
	t.Helper()
	scheme := runtime.NewScheme()
	scheme.AddKnownTypeWithName(testTypeMetaGVK, &unstructured.Unstructured{})
	for _, info := range (typeMetaDefaulting{serializer.NewCodecFactory(scheme)}).SupportedMediaTypes() {
		if info.MediaType == mediaType {
			if strict {
				return info.StrictSerializer
			}
			return info.Serializer
		}
	}
	t.Fatalf("no serializer for %s", mediaType)
	return nil
}

var testTypeMetaGVK = schema.GroupVersionKind{Group: "example.ext.grafana.app", Version: "v1alpha1", Kind: "TestKind"}

func TestTypeMetaDefaultingDecode(t *testing.T) {
	bodies := map[string]struct{ bare, otherVersion, duplicate string }{
		runtime.ContentTypeJSON: {
			bare:         `{"metadata":{"name":"x"},"spec":{"count":3}}`,
			otherVersion: `{"apiVersion":"example.ext.grafana.app/v9","spec":{}}`,
			duplicate:    `{"spec":{"a":1,"a":2}}`,
		},
		runtime.ContentTypeYAML: {
			bare:         "metadata:\n  name: x\nspec:\n  count: 3\n",
			otherVersion: "apiVersion: example.ext.grafana.app/v9\nspec: {}\n",
			duplicate:    "spec:\n  a: 1\n  a: 2\n",
		},
	}
	for mediaType, body := range bodies {
		t.Run(mediaType, func(t *testing.T) {
			defaults := testTypeMetaGVK
			decode := func(strict bool, data string) (*unstructured.Unstructured, *schema.GroupVersionKind, error) {
				into := &unstructured.Unstructured{}
				obj, gvk, err := typeMetaSerializer(t, mediaType, strict).Decode([]byte(data), &defaults, into)
				if obj != nil {
					require.Same(t, into, obj, "decodes into the object it was given")
				}
				return into, gvk, err
			}

			u, gvk, err := decode(false, body.bare)
			require.NoError(t, err)
			require.Equal(t, testTypeMetaGVK, *gvk)
			require.Equal(t, testTypeMetaGVK, u.GroupVersionKind())
			require.Equal(t, "x", u.GetName())
			require.Equal(t, int64(3), u.Object["spec"].(map[string]any)["count"], "integers stay integers")

			u, gvk, err = decode(false, body.otherVersion)
			require.NoError(t, err)
			want := schema.GroupVersionKind{Group: "example.ext.grafana.app", Version: "v9", Kind: "TestKind"}
			require.Equal(t, want, *gvk, "the body's version is kept for the handler to check")
			require.Equal(t, want, u.GroupVersionKind())

			_, _, err = decode(false, body.duplicate)
			require.NoError(t, err, "duplicates are only an error when strict")
			u, _, err = decode(true, body.duplicate)
			require.True(t, runtime.IsStrictDecodingError(err), err)
			require.Equal(t, testTypeMetaGVK, u.GroupVersionKind(), "a strict error still returns the object")

			_, _, err = decode(false, "[1, 2]")
			require.Error(t, err)
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
	return postTestKindAs(t, handler, "application/json", query, body)
}

func postTestKindAs(t *testing.T, handler http.Handler, contentType, query, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost,
		"/apis/example.ext.grafana.app/v1alpha1/namespaces/default/testkinds"+query, strings.NewReader(body))
	req.Header.Set("Content-Type", contentType)
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	return res
}

// A manifest kind can be created without repeating the apiVersion and kind
// the URL already names, as any typed Grafana resource can.
func TestHandlerDefaultsTypeMetaFromTheURL(t *testing.T) {
	for _, tc := range []struct{ name, contentType, query, body string }{
		{"json", "application/json", "", untypedObjectJSON},
		{"json strict validation", "application/json", "?fieldValidation=Strict", untypedObjectJSON},
		{"yaml", "application/yaml", "", "metadata:\n  name: example\n  namespace: default\nspec:\n  testField: hello\n"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			storage := &resourceClient{}
			opts := allowAll(testOptions())
			opts.Storage = UnifiedStorage(storage, nil, nil)
			handler := withRequester(loadHandler(t, typeMetaPlugin(), opts))

			res := postTestKindAs(t, handler, tc.contentType, tc.query, tc.body)
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

// Warn validation still creates the object, because the decoder returns it
// alongside the strict error.
func TestHandlerTypeMetaDefaultingWarnsOnDuplicates(t *testing.T) {
	opts := allowAll(testOptions())
	opts.Storage = UnifiedStorage(&resourceClient{}, nil, nil)
	handler := withRequester(loadHandler(t, typeMetaPlugin(), opts))

	res := postTestKind(t, handler, "?fieldValidation=Warn",
		`{"metadata":{"name":"example"},"spec":{"testField":"a","testField":"b"}}`)
	require.Equal(t, http.StatusCreated, res.Code, res.Body.String())
	require.Contains(t, res.Header().Get("Warning"), "duplicate field")
}
