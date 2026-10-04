package kindstore

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

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
			pluginv3.ConvertObjectsResponse_Object_builder{Raw: converted}.Build(),
		}}.Build(), nil
	})
	opts, scoped := newStoreOpts(t, gvk)
	_, err := New(gvk, app.ManifestVersionKind{Kind: gvk.Kind, Plural: "testkinds"}, nil, client, opts, nil)
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
	_, err = serializer.Decode(ctx, converted, nil)
	require.NoError(t, err)
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
