package apistore

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/storage/storagebackend"
)

func TestJSONSerializer(t *testing.T) {
	ctx := context.Background()
	serializer := JSONSerializer()
	original := &capWidget{
		TypeMeta:   metav1.TypeMeta{APIVersion: "unregistered.example/v2", Kind: "Widget"},
		ObjectMeta: metav1.ObjectMeta{Name: "test", Generation: 9007199254740993},
		Value:      "hello",
	}
	raw, err := serializer.Encode(ctx, original)
	require.NoError(t, err)

	t.Run("decode into typed object without scheme registration", func(t *testing.T) {
		into := &capWidget{}
		decoded, err := serializer.Decode(ctx, raw, into)
		require.NoError(t, err)
		require.Same(t, into, decoded)
		require.Equal(t, original, decoded)
	})
	for _, tc := range []struct {
		name string
		into runtime.Object
	}{
		{name: "nil target"},
		{name: "unstructured target", into: &unstructured.Unstructured{}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			decoded, err := serializer.Decode(ctx, raw, tc.into)
			require.NoError(t, err)
			obj := decoded.(*unstructured.Unstructured)
			require.Equal(t, original.APIVersion, obj.GetAPIVersion())
			require.Equal(t, original.Kind, obj.GetKind())
			require.Equal(t, original.Generation, obj.GetGeneration())
			require.Equal(t, original.Value, obj.Object["value"])
			if tc.into != nil {
				require.Same(t, tc.into, decoded)
			}
		})
	}
	t.Run("invalid JSON", func(t *testing.T) {
		_, err := serializer.Decode(ctx, []byte(`{"metadata":`), &capWidget{})
		require.Error(t, err)
	})
	t.Run("unsupported JSON value", func(t *testing.T) {
		obj := &unstructured.Unstructured{Object: map[string]interface{}{"value": make(chan int)}}
		raw, err := serializer.Encode(ctx, obj)
		require.Error(t, err)
		require.Nil(t, raw)
	})
}

type testSerializer struct {
	encode func(context.Context, runtime.Object) (json.RawMessage, error)
	decode func(context.Context, []byte, runtime.Object) (runtime.Object, error)
}

func (s *testSerializer) Encode(ctx context.Context, obj runtime.Object) (json.RawMessage, error) {
	return s.encode(ctx, obj)
}
func (s *testSerializer) Decode(ctx context.Context, data []byte, into runtime.Object) (runtime.Object, error) {
	return s.decode(ctx, data, into)
}

func TestStorageSerializer(t *testing.T) {
	type contextKey struct{}
	ctx := context.WithValue(context.Background(), contextKey{}, "request")
	expected := errors.New("serialization failed")
	obj := &capWidget{Value: "hello"}
	gv := schema.GroupVersion{Group: "example.com", Version: "v1"}
	codec := newCapCodec(t, gv, schema.GroupVersion{Group: gv.Group, Version: "v2"})
	data := []byte(`{"value":"hello"}`)
	custom := &testSerializer{
		encode: func(gotCtx context.Context, got runtime.Object) (json.RawMessage, error) {
			require.Equal(t, "request", gotCtx.Value(contextKey{}))
			require.Same(t, obj, got)
			return nil, expected
		},
		decode: func(gotCtx context.Context, got []byte, into runtime.Object) (runtime.Object, error) {
			require.Equal(t, "request", gotCtx.Value(contextKey{}))
			require.Equal(t, data, got)
			require.Same(t, obj, into)
			return obj, expected
		},
	}
	for _, tc := range []struct {
		name       string
		serializer Serializer
	}{
		{name: "default codec"},
		{name: "explicit JSON", serializer: JSONSerializer()},
		{name: "custom", serializer: custom},
	} {
		t.Run(tc.name, func(t *testing.T) {
			config := storagebackend.NewDefaultConfig("", codec)
			store, destroy, err := NewStorage(config.ForResource(schema.GroupResource{Group: "example.com", Resource: "widgets"}), nil, nil, nil, nil, nil, nil, nil, nil, nil, StorageOptions{Serializer: tc.serializer})
			require.NoError(t, err)
			t.Cleanup(destroy)
			s := store.(*Storage)
			if tc.serializer == nil {
				require.IsType(t, &codecSerializer{}, s.serializer)
				require.Same(t, codec, s.serializer.(*codecSerializer).codec)
			} else {
				require.Same(t, tc.serializer, s.serializer)
			}
			if tc.serializer != custom {
				raw, err := s.encode(ctx, obj, true)
				require.NoError(t, err)
				var stored capWidget
				require.NoError(t, json.Unmarshal(raw, &stored))
				require.Equal(t, obj.Value, stored.Value)
				if tc.serializer == nil {
					require.Equal(t, gv.String(), stored.APIVersion)
					require.Equal(t, "Widget", stored.Kind)
				} else {
					require.Empty(t, stored.APIVersion)
					require.Empty(t, stored.Kind)
				}
				decoded, err := s.convertToObject(ctx, raw, &capWidget{})
				require.NoError(t, err)
				require.Equal(t, obj.Value, decoded.(*capWidget).Value)
				return
			}
			require.Same(t, custom, s.serializer)
			raw, err := s.encode(ctx, obj, true)
			require.ErrorIs(t, err, expected)
			require.Nil(t, raw)
			decoded, err := s.convertToObject(ctx, data, obj)
			require.ErrorIs(t, err, expected)
			require.Same(t, obj, decoded)
		})
	}
}

func TestDefaultSerializerPreservesDeclaredGVK(t *testing.T) {
	gv := schema.GroupVersion{Group: "example.com", Version: "v1"}
	higherGV := schema.GroupVersion{Group: gv.Group, Version: "v2"}
	codec := newCapCodec(t, higherGV, gv)
	config := storagebackend.NewDefaultConfig("", codec)
	for _, tc := range []struct {
		name        string
		gvk         schema.GroupVersionKind
		serializer  Serializer
		wantVersion string
		wantErr     bool
	}{
		{name: "fills missing GVK", wantVersion: gv.String()},
		{name: "preserves object version", gvk: gv.WithKind("Widget"), wantVersion: gv.String()},
		{name: "rejects over-cap version", gvk: higherGV.WithKind("Widget"), wantErr: true},
		{name: "custom serializer overrides declared GVK", serializer: versionedSerializer{apiVersion: higherGV.String()}, wantErr: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store, destroy, err := NewStorage(config.ForResource(gv.WithResource("widgets").GroupResource()), nil, nil, nil, nil, nil, nil, nil, nil, nil, StorageOptions{
				GVK:           gv.WithKind("Widget"),
				VersionPolicy: newGlobalCapRegistry(gv.Group, []string{"v2", "v1"}, "v1"),
				Serializer:    tc.serializer,
			})
			require.NoError(t, err)
			t.Cleanup(destroy)
			obj := &capWidget{Value: "hello"}
			obj.SetGroupVersionKind(tc.gvk)
			raw, err := store.(*Storage).encode(t.Context(), obj, true)
			if tc.wantErr {
				require.ErrorContains(t, err, "exceeds the configured maximum version")
				require.Nil(t, raw)
				return
			}
			require.NoError(t, err)
			var stored capWidget
			require.NoError(t, json.Unmarshal(raw, &stored))
			require.Equal(t, tc.wantVersion, stored.APIVersion)
			require.Equal(t, "Widget", stored.Kind)
			require.Equal(t, obj.Value, stored.Value)
		})
	}
}
