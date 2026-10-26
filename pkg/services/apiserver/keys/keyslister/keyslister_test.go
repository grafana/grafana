package keyslister

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"testing"

	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	keysapi "github.com/grafana/grafana/pkg/services/apiserver/keys"
)

func testKind() resource.Kind {
	return resource.Kind{
		Schema: resource.NewSimpleSchema("example.grafana.app", "v1alpha1",
			&resource.TypedSpecObject[string]{}, &resource.TypedList[*resource.TypedSpecObject[string]]{},
			resource.WithKind("Example")),
		Codecs: map[resource.KindEncoding]resource.Codec{resource.KindEncodingJSON: resource.NewJSONCodec()},
	}
}

type fakeKeys struct {
	keys   []keysapi.Key
	listRV int64
	err    error
}

func (f fakeKeys) ListKeys(context.Context) (int64, iter.Seq2[keysapi.Key, error]) {
	return f.listRV, func(yield func(keysapi.Key, error) bool) {
		for _, k := range f.keys {
			if !yield(k, nil) {
				return
			}
		}
		if f.err != nil {
			yield(keysapi.Key{}, f.err)
		}
	}
}

// fakeClient stands in for the kind's client, which only the full-object fallback would call.
type fakeClient struct {
	resource.Client
}

type fakeObjects struct {
	called bool
	objs   []resource.Object
	listRV string
	err    error
}

func (f *fakeObjects) List(context.Context) ([]resource.Object, string, error) {
	f.called = true
	return f.objs, f.listRV, f.err
}

func TestListKeys(t *testing.T) {
	kind := testKind()
	keys := fakeKeys{listRV: 42, keys: []keysapi.Key{
		{Namespace: "default", Name: "one", ResourceVersion: "11"},
		{Namespace: "other", Name: "two", ResourceVersion: "12"},
	}}
	objects := &fakeObjects{}

	objs, listRV, err := New(keys, kind, objects, operator.RelistRecorder{}).List(context.Background())
	require.NoError(t, err)

	assert.Equal(t, "42", listRV)
	assert.False(t, objects.called)
	require.Len(t, objs, 2)
	for i, want := range keys.keys {
		assert.Equal(t, want.Namespace, objs[i].GetNamespace())
		assert.Equal(t, want.Name, objs[i].GetName())
		assert.Equal(t, want.ResourceVersion, objs[i].GetResourceVersion())
		assert.Equal(t, kind.GroupVersionKind(), objs[i].GetObjectKind().GroupVersionKind())
	}
}

func TestListFallsBackWhenKeysAreUnsupported(t *testing.T) {
	objects := &fakeObjects{objs: []resource.Object{testKind().ZeroValue()}, listRV: "7"}
	keys := fakeKeys{err: fmt.Errorf("over HTTP the route is absent: %w", keysapi.ErrUnsupported)}

	objs, listRV, err := New(keys, testKind(), objects, operator.RelistRecorder{}).List(context.Background())
	require.NoError(t, err)

	assert.True(t, objects.called)
	assert.Equal(t, "7", listRV)
	assert.Len(t, objs, 1)
}

// A partial stream is a failed re-list, not a shorter snapshot: the informer diffs the whole set, so a truncated one
// reads as a mass deletion.
func TestListFailsOnAPartialStream(t *testing.T) {
	wantErr := errors.New("page 2 failed")
	objects := &fakeObjects{}
	keys := fakeKeys{listRV: 42, keys: []keysapi.Key{{Namespace: "default", Name: "one", ResourceVersion: "11"}}, err: wantErr}

	objs, listRV, err := New(keys, testKind(), objects, operator.RelistRecorder{}).List(context.Background())

	assert.ErrorIs(t, err, wantErr)
	assert.Nil(t, objs)
	assert.Empty(t, listRV)
	assert.False(t, objects.called)
}

func TestFactory(t *testing.T) {
	kind := testKind()
	var asked []schema.GroupVersionResource
	listerFor := func(gvr schema.GroupVersionResource) keysapi.Lister {
		asked = append(asked, gvr)
		return fakeKeys{}
	}

	t.Run("an unfiltered kind lists identities", func(t *testing.T) {
		asked = nil
		_, err := Factory(listerFor)(kind, fakeClient{}, operator.ClientListerOptions{})
		require.NoError(t, err)

		assert.Equal(t, []schema.GroupVersionResource{kind.GroupVersionResource()}, asked)
	})

	// A keys-only list carries no namespace scope and no selectors, so these can only be served by objects.
	tests := []struct {
		name string
		opts operator.ListWatchOptions
	}{
		{name: "namespace", opts: operator.ListWatchOptions{Namespace: "default"}},
		{name: "label filters", opts: operator.ListWatchOptions{LabelFilters: []string{"a=b"}}},
		{name: "field selectors", opts: operator.ListWatchOptions{FieldSelectors: []string{"spec.a=b"}}},
	}
	for _, tt := range tests {
		t.Run(tt.name+" lists objects", func(t *testing.T) {
			asked = nil
			_, err := Factory(listerFor)(kind, fakeClient{}, operator.ClientListerOptions{ListWatchOptions: tt.opts})
			require.NoError(t, err)

			assert.Empty(t, asked)
		})
	}
}
