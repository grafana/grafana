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

func playlistBuilderInfo(t *testing.T, r KVSourceReader) resource.DocumentBuilderInfo {
	t.Helper()
	for _, info := range KVSourcedDocumentBuilders(kvSourcedRegistry(t), r, nil) {
		if info.GroupResource == (schema.GroupResource{Group: plGroup, Resource: plResource}) {
			return info
		}
	}
	t.Fatal("playlists must get a KV-sourced builder")
	return resource.DocumentBuilderInfo{}
}

// A KV-sourced builder built after a failed scan says so, so the periodic
// freshness check can tell "the scan failed" from "every value vanished",
// while its documents are still built without the KV fields.
func TestKVSourcedBuilder_ReportsAFailedScan(t *testing.T) {
	t.Parallel()
	boom := errors.New("kv scan unavailable")
	info := playlistBuilderInfo(t, &recordingReader{inner: newKVFieldsStore(t), err: boom})

	b, err := info.Namespaced(context.Background(), testNS, nil)
	require.NoError(t, err)

	doc, err := b.BuildDocument(context.Background(), playlistKey("p1"), 1, playlistBody("p1"))
	require.NoError(t, err)
	_, has := doc.Fields["views_total"]
	assert.False(t, has, "views_total must be absent after a failed scan")

	reporter, ok := b.(resource.KVFieldSnapshotErrorReporter)
	require.True(t, ok, "a KV-sourced builder must report whether its scan failed")
	assert.ErrorIs(t, reporter.KVFieldSnapshotErr(), boom)
}

func TestKVSourcedBuilder_ReportsNoErrorAfterAGoodScan(t *testing.T) {
	t.Parallel()
	store := newKVFieldsStore(t)
	saveKV(t, store, plGroup, plResource, testNS, "p1", uiOwner, "stats", `{"views_total":30}`)
	info := playlistBuilderInfo(t, store)

	b, err := info.Namespaced(context.Background(), testNS, nil)
	require.NoError(t, err)

	reporter, ok := b.(resource.KVFieldSnapshotErrorReporter)
	require.True(t, ok, "a KV-sourced builder must report whether its scan failed")
	assert.NoError(t, reporter.KVFieldSnapshotErr())
}
