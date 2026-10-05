package kindstore

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/warning"

	"github.com/grafana/grafana-app-sdk/app"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
)

type conversionClientFunc func(context.Context, *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error)

func (f conversionClientFunc) ConvertObjects(ctx context.Context, req *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
	return f(ctx, req)
}

func TestConversionSerializer(t *testing.T) {
	gvk := schema.GroupVersionKind{Group: "example-app", Version: "v2", Kind: "TestKind"}
	raw := []byte(`{"apiVersion":"example-app/v1","kind":"TestKind","metadata":{"name":"test","resourceVersion":"123"},"spec":{"old":"value"}}`)
	converted := []byte(`{"apiVersion":"example-app/v2","kind":"TestKind","metadata":{"name":"test","resourceVersion":"123"},"spec":{"new":"value"}}`)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	recorder := &warningRecorder{}
	ctx = warning.WithWarningRecorder(ctx, recorder)
	calls := 0
	client := conversionClientFunc(func(gotCtx context.Context, req *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
		calls++
		require.Same(t, ctx, gotCtx)
		require.Equal(t, gvk.Group, req.GetApi().GetGroup())
		require.Equal(t, gvk.Version, req.GetApi().GetVersion())
		require.Equal(t, gvk.Version, req.GetTargetVersion())
		require.NotEmpty(t, req.GetUid())
		require.Len(t, req.GetObjects(), 1)
		obj := req.GetObjects()[0]
		require.Equal(t, "v1", obj.GetGvk().GetVersion())
		require.Equal(t, gvk.Group, obj.GetGvk().GetGroup())
		require.Equal(t, gvk.Kind, obj.GetGvk().GetKind())
		require.Equal(t, raw, obj.GetRaw())
		return pluginv3.ConvertObjectsResponse_builder{Converted: []*pluginv3.ConvertObjectsResponse_Object{
			pluginv3.ConvertObjectsResponse_Object_builder{Raw: converted, Warnings: []string{"deprecated field"}}.Build(),
		}}.Build(), nil
	})
	opts, scoped := newStoreOpts(t, gvk)
	_, err := New(gvk, app.ManifestVersionKind{Kind: gvk.Kind, Plural: "testkinds", Conversion: true}, nil, client, opts, nil)
	require.NoError(t, err)
	require.NotNil(t, scoped.Serializer)
	serializer := scoped.Serializer
	for _, into := range []runtime.Object{nil, &unstructured.Unstructured{}} {
		obj, err := serializer.Decode(ctx, raw, into)
		require.NoError(t, err)
		if into != nil {
			require.Same(t, into, obj)
		}
		require.Equal(t, gvk, obj.GetObjectKind().GroupVersionKind())
		u := obj.(*unstructured.Unstructured)
		require.Equal(t, "test", u.GetName())
		require.Equal(t, "123", u.GetResourceVersion())
		require.Equal(t, map[string]any{"new": "value"}, u.Object["spec"])
		encoded, err := serializer.Encode(ctx, obj)
		require.NoError(t, err)
		require.JSONEq(t, string(converted), string(encoded))
	}
	require.Equal(t, 2, calls)
	require.Equal(t, []string{"deprecated field", "deprecated field"}, recorder.warnings)
	for _, into := range []runtime.Object{nil, &unstructured.Unstructured{Object: map[string]any{"stale": true}}} {
		obj, err := serializer.Decode(ctx, converted, into)
		require.NoError(t, err)
		if into != nil {
			require.Same(t, into, obj)
		}
		encoded, err := serializer.Encode(ctx, obj)
		require.NoError(t, err)
		require.JSONEq(t, string(converted), string(encoded))
	}
	require.Equal(t, 2, calls, "same-version objects do not need conversion")
	_, err = serializer.Decode(ctx, []byte(`{`), nil)
	require.Error(t, err)
	require.Equal(t, 2, calls)

	opts, scoped = newStoreOpts(t, gvk)
	_, err = New(gvk, app.ManifestVersionKind{Kind: gvk.Kind, Plural: "testkinds"}, nil, nil, opts, nil)
	require.NoError(t, err)
	require.Nil(t, scoped.Serializer)
}

func TestConversionSerializerErrors(t *testing.T) {
	failure := errors.New("unavailable")
	status := &pluginv3.StatusResult{}
	status.SetMessage("unsupported version")
	for _, tc := range []struct {
		name     string
		response *pluginv3.ConvertObjectsResponse
		err      error
		want     string
	}{
		{name: "transport", err: failure, want: "unavailable"},
		{name: "plugin", response: pluginv3.ConvertObjectsResponse_builder{Error: status}.Build(), want: "unsupported version"},
		{name: "nil response", want: "returned 0 objects"},
		{name: "empty response", response: &pluginv3.ConvertObjectsResponse{}, want: "returned 0 objects"},
		{name: "extra objects", response: pluginv3.ConvertObjectsResponse_builder{Converted: []*pluginv3.ConvertObjectsResponse_Object{{}, {}}}.Build(), want: "returned 2 objects"},
		{name: "invalid JSON", response: pluginv3.ConvertObjectsResponse_builder{Converted: []*pluginv3.ConvertObjectsResponse_Object{pluginv3.ConvertObjectsResponse_Object_builder{Raw: []byte(`{`)}.Build()}}.Build(), want: "unexpected end"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			gvk := schema.GroupVersionKind{Group: "example-app", Version: "v2", Kind: "TestKind"}
			opts, scoped := newStoreOpts(t, gvk)
			client := conversionClientFunc(func(context.Context, *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
				return tc.response, tc.err
			})
			_, err := New(gvk, app.ManifestVersionKind{Kind: gvk.Kind, Plural: "testkinds"}, nil, client, opts, nil)
			require.NoError(t, err)
			_, err = scoped.Serializer.Decode(context.Background(), []byte(`{"apiVersion":"example-app/v1","kind":"TestKind"}`), nil)
			require.ErrorContains(t, err, tc.want)
			if tc.err != nil {
				require.ErrorIs(t, err, tc.err)
			}
		})
	}
}

func TestConversionSerializerValidatesResponse(t *testing.T) {
	gvk := schema.GroupVersionKind{Group: "example-app", Version: "v2", Kind: "TestKind"}
	raw := []byte(`{"apiVersion":"example-app/v1","kind":"TestKind","metadata":{"name":"test","namespace":"default","uid":"original"}}`)
	for _, tc := range []struct {
		name  string
		path  []string
		value any
		want  string
	}{
		{name: "wrong group", path: []string{"apiVersion"}, value: "other/v2", want: "unexpected GVK"},
		{name: "wrong version", path: []string{"apiVersion"}, value: "example-app/v1", want: "unexpected GVK"},
		{name: "missing version", path: []string{"apiVersion"}, want: "unexpected GVK"},
		{name: "wrong kind", path: []string{"kind"}, value: "OtherKind", want: "unexpected GVK"},
		{name: "missing kind", path: []string{"kind"}, want: "invalid object"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var converted unstructured.Unstructured
			require.NoError(t, json.Unmarshal(raw, &converted))
			converted.SetGroupVersionKind(gvk)
			if tc.value == nil {
				unstructured.RemoveNestedField(converted.Object, tc.path...)
			} else {
				require.NoError(t, unstructured.SetNestedField(converted.Object, tc.value, tc.path...))
			}
			payload, err := json.Marshal(&converted)
			require.NoError(t, err)
			serializer := &conversionSerializer{
				gvk: gvk,
				client: conversionClientFunc(func(context.Context, *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
					return pluginv3.ConvertObjectsResponse_builder{Converted: []*pluginv3.ConvertObjectsResponse_Object{
						pluginv3.ConvertObjectsResponse_Object_builder{Raw: payload}.Build(),
					}}.Build(), nil
				}),
			}
			for _, into := range []runtime.Object{nil, &unstructured.Unstructured{Object: map[string]any{"untouched": true}}} {
				var before runtime.Object
				if into != nil {
					before = into.DeepCopyObject()
				}
				obj, err := serializer.Decode(context.Background(), raw, into)
				require.ErrorContains(t, err, tc.want)
				require.Nil(t, obj)
				require.Equal(t, before, into)
			}
		})
	}
}

func TestConversionSerializerPreservesMetadata(t *testing.T) {
	gvk := schema.GroupVersionKind{Group: "example-app", Version: "v2", Kind: "TestKind"}
	raw := []byte(`{"apiVersion":"example-app/v1","kind":"TestKind","metadata":{"name":"test","namespace":"default","uid":"original","resourceVersion":"123","generation":3,"finalizers":["example-app/cleanup"],"creationTimestamp":"2026-10-01T00:00:00Z","deletionTimestamp":"2026-10-02T00:00:00Z","deletionGracePeriodSeconds":30,"ownerReferences":[{"apiVersion":"example-app/v1","kind":"Owner","name":"parent","uid":"parent-uid"}],"managedFields":[{"manager":"test","operation":"Update","apiVersion":"example-app/v1","fieldsType":"FieldsV1","fieldsV1":{"f:spec":{}}}],"labels":{"old":"label"},"annotations":{"old":"annotation"}},"spec":{"old":"value"}}`)
	for _, mode := range []string{"altered", "removed", "empty", "null", "invalid", "null labels and annotations", "invalid labels and annotations"} {
		t.Run(mode, func(t *testing.T) {
			var original unstructured.Unstructured
			require.NoError(t, json.Unmarshal(raw, &original))
			converted := original.DeepCopy()
			converted.SetGroupVersionKind(gvk)
			metadata := converted.Object["metadata"].(map[string]any)
			switch mode {
			case "altered":
				for key := range metadata {
					metadata[key] = "altered"
				}
				converted.SetLabels(map[string]string{"new": "label"})
				converted.SetAnnotations(map[string]string{"new": "annotation"})
			case "removed":
				delete(converted.Object, "metadata")
			case "empty":
				converted.Object["metadata"] = map[string]any{}
			case "null":
				converted.Object["metadata"] = nil
			case "invalid":
				converted.Object["metadata"] = "invalid"
			case "null labels and annotations":
				metadata["labels"] = nil
				metadata["annotations"] = nil
			case "invalid labels and annotations":
				metadata["labels"] = map[string]any{"label": int64(1)}
				metadata["annotations"] = map[string]any{"annotation": int64(1)}
			}
			converted.Object["spec"] = map[string]any{"new": "value"}
			converted.Object["status"] = map[string]any{"state": "converted"}
			payload, err := json.Marshal(converted)
			require.NoError(t, err)
			serializer := &conversionSerializer{
				gvk: gvk,
				client: conversionClientFunc(func(context.Context, *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
					return pluginv3.ConvertObjectsResponse_builder{Converted: []*pluginv3.ConvertObjectsResponse_Object{
						pluginv3.ConvertObjectsResponse_Object_builder{Raw: payload}.Build(),
					}}.Build(), nil
				}),
			}
			expected := original.DeepCopy()
			expected.SetGroupVersionKind(gvk)
			expected.Object["spec"] = map[string]any{"new": "value"}
			expected.Object["status"] = map[string]any{"state": "converted"}
			for _, into := range []runtime.Object{nil, &unstructured.Unstructured{Object: map[string]any{"stale": true}}} {
				obj, err := serializer.Decode(context.Background(), raw, into)
				require.NoError(t, err)
				require.Equal(t, expected, obj)
				if into != nil {
					require.Same(t, into, obj)
				}
			}
		})
	}
}
