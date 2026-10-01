package builders

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

// As a second line of defence, BuildKVFieldSnapshot
// re-checks Owner and Key on every item the reader returns, so a reader
// that returns another owner's (or another key's) item can never leak its
// value into a search field.

// looseReader returns a fixed set of items for any (owner, key) request, the
// way a suffix-matching scan could.
type looseReader struct{ items []kv.ResourceKVItem }

func (r looseReader) ScanNamespaceOwnerKey(_ context.Context, _, _, _, _, _ string) ([]kv.ResourceKVItem, error) {
	return r.items, nil
}

func TestBuildKVFieldSnapshot_IgnoresItemsWithAnotherOwnerOrKey(t *testing.T) {
	t.Parallel()
	reader := looseReader{items: []kv.ResourceKVItem{
		{Name: "legit", Owner: uiOwner, Key: "stats", Value: []byte(`{"views_total":3}`)},
		{Name: "other-owner", Owner: "evil.example.app", Key: uiOwner + "/stats", Value: []byte(`{"views_total":9999}`)},
		{Name: "suffix-owner", Owner: "x." + uiOwner, Key: "stats", Value: []byte(`{"views_total":9999}`)},
		{Name: "other-key", Owner: uiOwner, Key: "daily", Value: []byte(`{"views_total":9999}`)},
		{Name: "deep-key", Owner: uiOwner, Key: "a/stats", Value: []byte(`{"views_total":9999}`)},
	}}
	defs := []resource.SearchFieldDefinition{
		kvFieldDef("views_total", uiOwner, "stats", "views_total", resource.SearchFieldTypeInt64),
	}

	snap, err := BuildKVFieldSnapshot(context.Background(), reader, "playlist.grafana.app", "playlists", "default", defs)
	require.NoError(t, err)
	assert.Equal(t, resource.KVFieldSnapshot{"legit": {"views_total": int64(3)}}, snap,
		"only items whose Owner and Key equal the declared source may contribute")
}

// An item for the right owner but carrying the other declared source's key
// fills only that source's fields.
func TestBuildKVFieldSnapshot_ItemKeyMustMatchItsSource(t *testing.T) {
	t.Parallel()
	reader := looseReader{items: []kv.ResourceKVItem{
		{Name: "p1", Owner: uiOwner, Key: "stats", Value: []byte(`{"n":1}`)},
		{Name: "p1", Owner: uiOwner, Key: "other", Value: []byte(`{"n":2}`)},
	}}
	defs := []resource.SearchFieldDefinition{
		kvFieldDef("from_stats", uiOwner, "stats", "n", resource.SearchFieldTypeInt64),
		kvFieldDef("from_other", uiOwner, "other", "n", resource.SearchFieldTypeInt64),
	}

	snap, err := BuildKVFieldSnapshot(context.Background(), reader, "playlist.grafana.app", "playlists", "default", defs)
	require.NoError(t, err)
	assert.Equal(t, resource.KVFieldSnapshot{"p1": {"from_stats": int64(1), "from_other": int64(2)}}, snap)
}
