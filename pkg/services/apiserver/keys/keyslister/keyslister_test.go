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
	"github.com/grafana/grafana/pkg/setting"
)

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

// drain collects the adapted sequence the way the SDK's identity lister does.
func drain(t *testing.T, keys iter.Seq2[operator.ResourceKey, error]) ([]operator.ResourceKey, error) {
	t.Helper()
	var out []operator.ResourceKey
	for key, err := range keys {
		if err != nil {
			return out, err
		}
		out = append(out, key)
	}
	return out, nil
}

func TestEnabled(t *testing.T) {
	cfg := setting.NewCfg()
	assert.False(t, Enabled(cfg), "an unset key keeps the full-object re-list")

	section, err := cfg.Raw.NewSection(ConfigSection)
	require.NoError(t, err)
	_, err = section.NewKey(ConfigKey, "true")
	require.NoError(t, err)
	assert.True(t, Enabled(cfg))
}

func TestListKeys(t *testing.T) {
	listRV, keys := New(fakeKeys{listRV: 42, keys: []keysapi.Key{
		{Namespace: "default", Name: "one", ResourceVersion: "11", Folder: "folder-1"},
		{Namespace: "other", Name: "two", ResourceVersion: "12"},
	}}).ListKeys(context.Background())

	got, err := drain(t, keys)
	require.NoError(t, err)

	assert.Equal(t, "42", listRV)
	assert.Equal(t, []operator.ResourceKey{
		{Namespace: "default", Name: "one", ResourceVersion: "11"},
		{Namespace: "other", Name: "two", ResourceVersion: "12"},
	}, got)
}

// The SDK's fallback lister keys off its own sentinel, so an unsupported projection has to carry it.
func TestListKeysMarksAnUnsupportedProjection(t *testing.T) {
	inner := fmt.Errorf("over HTTP the route is absent: %w", keysapi.ErrUnsupported)
	_, keys := New(fakeKeys{err: inner}).ListKeys(context.Background())

	_, err := drain(t, keys)

	assert.ErrorIs(t, err, operator.ErrProjectionUnsupported)
	assert.ErrorIs(t, err, keysapi.ErrUnsupported)
}

// Any other error must not read as unsupported: the re-list fails and is retried, rather than being served the
// expensive way from then on.
func TestListKeysPropagatesOtherErrors(t *testing.T) {
	wantErr := errors.New("page 2 failed")
	_, keys := New(fakeKeys{listRV: 42, keys: []keysapi.Key{{Name: "one"}}, err: wantErr}).ListKeys(context.Background())

	got, err := drain(t, keys)

	assert.ErrorIs(t, err, wantErr)
	assert.NotErrorIs(t, err, operator.ErrProjectionUnsupported)
	assert.Len(t, got, 1)
}

func TestFactory(t *testing.T) {
	kind := resource.Kind{
		Schema: resource.NewSimpleSchema("example.grafana.app", "v1alpha1",
			&resource.TypedSpecObject[string]{}, &resource.TypedList[*resource.TypedSpecObject[string]]{},
			resource.WithKind("Example")),
		Codecs: map[resource.KindEncoding]resource.Codec{resource.KindEncodingJSON: resource.NewJSONCodec()},
	}

	var asked []schema.GroupVersionResource
	factory := Factory(func(gvr schema.GroupVersionResource) keysapi.Lister {
		asked = append(asked, gvr)
		return fakeKeys{}
	})

	t.Run("an unfiltered re-list reads identities", func(t *testing.T) {
		asked = nil
		lister, err := factory(kind, operator.ListWatchOptions{})
		require.NoError(t, err)

		assert.NotNil(t, lister)
		assert.Equal(t, []schema.GroupVersionResource{kind.GroupVersionResource()}, asked)
	})

	// The identities carry no namespace scope and no labels, so nothing downstream could apply a filter this lister
	// did not. Reporting the projection unsupported leaves the re-list on full objects.
	tests := []struct {
		name string
		opts operator.ListWatchOptions
	}{
		{name: "namespace", opts: operator.ListWatchOptions{Namespace: "default"}},
		{name: "label filters", opts: operator.ListWatchOptions{LabelFilters: []string{"a=b"}}},
		{name: "field selectors", opts: operator.ListWatchOptions{FieldSelectors: []string{"spec.a=b"}}},
	}
	for _, tt := range tests {
		t.Run("a re-list scoped by "+tt.name+" is unsupported", func(t *testing.T) {
			asked = nil
			_, err := factory(kind, tt.opts)

			assert.ErrorIs(t, err, operator.ErrProjectionUnsupported)
			assert.Empty(t, asked)
		})
	}
}
