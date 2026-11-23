package kindstore

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/app"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
)

// renameConverter moves spec.old to spec.new and sets the target apiVersion.
func renameConverter(calls *int) conversionClientFunc {
	return func(_ context.Context, req *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
		*calls++
		out := make([]*pluginv3.ConvertObjectsResponse_Object, 0, len(req.GetObjects()))
		for _, raw := range req.GetObjects() {
			var obj map[string]any
			if err := json.Unmarshal(raw, &obj); err != nil {
				return nil, err
			}
			obj["apiVersion"] = req.GetTarget().GetGroup() + "/" + req.GetTarget().GetVersion()
			spec := obj["spec"].(map[string]any)
			spec["new"] = spec["old"]
			delete(spec, "old")
			converted, err := json.Marshal(obj)
			if err != nil {
				return nil, err
			}
			out = append(out, pluginv3.ConvertObjectsResponse_Object_builder{Raw: converted}.Build())
		}
		return pluginv3.ConvertObjectsResponse_builder{Converted: out}.Build(), nil
	}
}

func convertingStore(t *testing.T, calls *int) *Store {
	t.Helper()
	gvk := schema.GroupVersionKind{Group: "example-app", Version: "v2", Kind: "TestKind"}
	opts, _ := newStoreOpts(t, gvk)
	opts.ConvertFrom = []string{"v1", "v2"} // the store's own version is ignored
	s, err := New(gvk, app.ManifestVersionKind{Kind: gvk.Kind, Plural: "testkinds", Resource: "testkinds", Conversion: true},
		nil, renameConverter(calls), opts, nil)
	require.NoError(t, err)
	return s
}

func v1Object() *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "example-app/v1",
		"kind":       "TestKind",
		"metadata":   map[string]any{"generateName": "test-", "labels": map[string]any{"a": "b"}},
		"spec":       map[string]any{"old": "value"},
	}}
}

func TestStoreAcceptsGroupVersion(t *testing.T) {
	s := convertingStore(t, new(int))
	require.True(t, s.AcceptsGroupVersion(schema.GroupVersion{Group: "example-app", Version: "v2"}))
	require.True(t, s.AcceptsGroupVersion(schema.GroupVersion{Group: "example-app", Version: "v1"}))
	require.False(t, s.AcceptsGroupVersion(schema.GroupVersion{Group: "example-app", Version: "v3"}))
	require.False(t, s.AcceptsGroupVersion(schema.GroupVersion{Group: "other-app", Version: "v1"}))

	plain := testStore(false, false)
	require.True(t, plain.AcceptsGroupVersion(plain.gvk.GroupVersion()))
	require.False(t, plain.AcceptsGroupVersion(schema.GroupVersion{Group: plain.gvk.Group, Version: "v1"}),
		"a kind without ConvertFrom only accepts its own version")
}

func TestNewConvertFromNeedsAConversionClient(t *testing.T) {
	gvk := schema.GroupVersionKind{Group: "example-app", Version: "v2", Kind: "TestKind"}
	opts, _ := newStoreOpts(t, gvk)
	opts.ConvertFrom = []string{"v1"}
	_, err := New(gvk, app.ManifestVersionKind{Kind: gvk.Kind, Plural: "testkinds", Resource: "testkinds"}, nil, nil, opts, nil)
	require.ErrorContains(t, err, "has no conversion client")
}

func TestStoreConvertIncoming(t *testing.T) {
	calls := 0
	s := convertingStore(t, &calls)
	ctx := context.Background()

	obj := v1Object()
	require.NoError(t, s.ConvertIncoming(ctx, obj))
	require.Equal(t, s.gvk, obj.GroupVersionKind())
	require.Equal(t, map[string]any{"new": "value"}, obj.Object["spec"])
	require.Equal(t, "test-", obj.GetGenerateName(), "the caller's metadata survives conversion")
	require.Equal(t, map[string]string{"a": "b"}, obj.GetLabels())
	require.Equal(t, 1, calls)

	require.NoError(t, s.ConvertIncoming(ctx, obj), "a body already in the store's version is left alone")
	require.Equal(t, 1, calls)

	other := v1Object()
	other.SetAPIVersion("example-app/v3")
	err := s.ConvertIncoming(ctx, other)
	require.True(t, apierrors.IsBadRequest(err), err)

	wrongKind := v1Object()
	wrongKind.SetKind("OtherKind")
	err = s.ConvertIncoming(ctx, wrongKind)
	require.True(t, apierrors.IsBadRequest(err), err)
	require.Equal(t, 1, calls)
}

// The update handler builds the new object inside objInfo, after Store.Update
// is entered, so the conversion has to wrap it.
func TestStoreUpdateConvertsTheUpdatedObject(t *testing.T) {
	calls := 0
	s := convertingStore(t, &calls)
	info := convertingObjectInfo{UpdatedObjectInfo: rest.DefaultUpdatedObjectInfo(v1Object()), store: s}
	obj, err := info.UpdatedObject(context.Background(), &unstructured.Unstructured{})
	require.NoError(t, err)
	u := obj.(*unstructured.Unstructured)
	require.Equal(t, s.gvk, u.GroupVersionKind())
	require.Equal(t, map[string]any{"new": "value"}, u.Object["spec"])
	require.Equal(t, 1, calls)
}
