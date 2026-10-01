package builders

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// When the KV scan fails, the kind is still indexed: the namespaced builder
// is returned without an error, and its documents simply omit the KV fields.
func TestKVSourcedDocumentBuilders_ScanErrorBuildsWithoutKVFields(t *testing.T) {
	t.Parallel()
	reader := &recordingReader{inner: newKVFieldsStore(t), err: errors.New("kv scan unavailable")}

	infos := KVSourcedDocumentBuilders(kvSourcedRegistry(t), reader, nil)
	var info *resource.DocumentBuilderInfo
	for i := range infos {
		if infos[i].GroupResource == (schema.GroupResource{Group: plGroup, Resource: plResource}) {
			info = &infos[i]
		}
	}
	require.NotNil(t, info, "playlists must get a builder")

	b, err := info.Namespaced(context.Background(), testNS, nil)
	require.NoError(t, err, "a KV scan error must not stop the kind from being indexed")
	require.NotNil(t, b)

	doc, err := b.BuildDocument(context.Background(), playlistKey("p1"), 1, playlistBody("p1"))
	require.NoError(t, err)
	require.NotNil(t, doc)
	_, has := doc.Fields["views_total"]
	assert.False(t, has, "views_total must be absent when the KV scan failed")

	if s, ok := b.(resource.KVFieldSnapshotter); ok {
		snap, _ := s.KVFieldSnapshot()
		assert.Empty(t, snap, "the snapshot must be empty after a failed scan")
	}
}
