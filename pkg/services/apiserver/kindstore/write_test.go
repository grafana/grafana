package kindstore

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
)

func TestDecodeWrite(t *testing.T) {
	for _, mediaType := range []string{"application/json", "application/yaml"} {
		t.Run(mediaType, func(t *testing.T) {
			obj, err := decodeWrite(t.Context(), []byte(`{"spec":{"count":9007199254740993}}`), mediaType, "Strict")
			require.NoError(t, err)
			require.Equal(t, int64(9007199254740993), obj.Object["spec"].(map[string]any)["count"])
			for _, body := range []string{"null", "[]", "42", `"hello"`, "", "{", "{} {}", "{}\n---\n{}"} {
				_, err := decodeWrite(t.Context(), []byte(body), mediaType, "Strict")
				require.Error(t, err, body)
			}
			duplicate := `{"spec":{"foo":"a","foo":"b"}}`
			if mediaType == "application/yaml" {
				duplicate = "spec:\n  foo: a\n  foo: b\n"
			}
			_, err = decodeWrite(t.Context(), []byte(duplicate), mediaType, "Strict")
			require.Error(t, err)
			for _, validation := range []string{"Ignore", "Warn", ""} {
				obj, err = decodeWrite(t.Context(), []byte(duplicate), mediaType, validation)
				require.NoError(t, err)
				require.Equal(t, "b", obj.Object["spec"].(map[string]any)["foo"])
			}
		})
	}
}

func TestWriteDecoderWithoutConversion(t *testing.T) {
	target := schema.GroupVersionKind{Group: "example.app", Version: "v2", Kind: "Thing"}
	decoder := NewWriteDecoder(target, nil, nil)
	for _, tc := range []struct {
		name, body string
		invalid    bool
	}{
		{name: "defaults", body: `{}`},
		{name: "default kind", body: `{"apiVersion":"example.app/v2"}`},
		{name: "default version", body: `{"kind":"Thing"}`},
		{name: "target version", body: `{"apiVersion":"example.app/v2","kind":"Thing"}`},
		{name: "wrong kind", body: `{"kind":"Other"}`, invalid: true},
		{name: "invalid metadata", body: `{"metadata":{"labels":{"label":42}}}`, invalid: true},
		{name: "conversion not enabled", body: `{"apiVersion":"example.app/v1"}`, invalid: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			obj, err := decoder.Decode(t.Context(), "default", []byte(tc.body), runtime.ContentTypeJSON, "Strict")
			if tc.invalid {
				require.True(t, apierrors.IsBadRequest(err), "%v", err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, target, obj.GroupVersionKind())
		})
	}
}

func TestWriteDecoderConversionConfiguration(t *testing.T) {
	target := schema.GroupVersionKind{Group: "example.app", Version: "v2", Kind: "Thing"}
	ctx := t.Context()
	calls := 0
	client := conversionClientFunc(func(got context.Context, req *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
		calls++
		require.Same(t, ctx, got)
		require.Equal(t, "default", req.GetNamespace())
		require.Equal(t, target.Version, req.GetTarget().GetVersion())
		require.Len(t, req.GetObjects(), 1)
		var obj unstructured.Unstructured
		require.NoError(t, obj.UnmarshalJSON(req.GetObjects()[0]))
		require.Equal(t, "example.app/v1", obj.GetAPIVersion())
		require.Equal(t, target.Kind, obj.GetKind(), "missing kind is defaulted before conversion")
		require.Equal(t, "default", obj.GetNamespace())
		obj.SetGroupVersionKind(target)
		obj.Object["spec"] = map[string]any{"new": "converted"}
		raw, err := obj.MarshalJSON()
		require.NoError(t, err)
		return pluginv3.ConvertObjectsResponse_builder{Converted: []*pluginv3.ConvertObjectsResponse_Object{
			pluginv3.ConvertObjectsResponse_Object_builder{Raw: raw}.Build(),
		}}.Build(), nil
	})
	sources := []schema.GroupVersion{{Group: target.Group, Version: "v1"}}
	decoder := NewWriteDecoder(target, sources, client)
	sources[0].Version = "v3"

	obj, err := decoder.Decode(ctx, "default", []byte(`{"apiVersion":"example.app/v1","spec":{"old":"value"}}`), runtime.ContentTypeJSON, "Strict")
	require.NoError(t, err, "the decoder must retain its configuration when the caller changes the input slice")
	require.Equal(t, target, obj.GroupVersionKind())
	require.Equal(t, map[string]any{"new": "converted"}, obj.Object["spec"])

	_, err = decoder.Decode(ctx, "default", []byte(`{"apiVersion":"example.app/v3"}`), runtime.ContentTypeJSON, "Strict")
	require.True(t, apierrors.IsBadRequest(err))
	require.Equal(t, 1, calls, "only the configured source version can reach conversion")
}
