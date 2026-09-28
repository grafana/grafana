package foldertitle

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// fakeStorage stubs just the ReadResource method the resolver uses.
type fakeStorage struct {
	resource.UnimplementedStorageBackend
	resp    *resource.BackendReadResponse
	reqSeen *resourcepb.ReadRequest
}

func (f *fakeStorage) ReadResource(_ context.Context, req *resourcepb.ReadRequest) *resource.BackendReadResponse {
	f.reqSeen = req
	return f.resp
}

func TestResolver_Title(t *testing.T) {
	t.Run("empty folderUID returns empty without touching storage", func(t *testing.T) {
		storage := &fakeStorage{}
		resolver := NewResolver(storage)

		title, err := resolver.Title(context.Background(), "ns-1", "")
		require.NoError(t, err)
		assert.Empty(t, title)
		assert.Nil(t, storage.reqSeen)
	})

	t.Run("NotFound returns empty, no error", func(t *testing.T) {
		storage := &fakeStorage{resp: &resource.BackendReadResponse{
			Error: &resourcepb.ErrorResult{Code: http.StatusNotFound, Message: "not found"},
		}}
		resolver := NewResolver(storage)

		title, err := resolver.Title(context.Background(), "ns-1", "folder-uid")
		require.NoError(t, err)
		assert.Empty(t, title)
	})

	t.Run("other storage error is returned", func(t *testing.T) {
		storage := &fakeStorage{resp: &resource.BackendReadResponse{
			Error: &resourcepb.ErrorResult{Code: http.StatusInternalServerError, Message: "boom"},
		}}
		resolver := NewResolver(storage)

		title, err := resolver.Title(context.Background(), "ns-1", "folder-uid")
		require.Error(t, err)
		assert.Empty(t, title)
	})

	t.Run("parses spec.title from the raw value", func(t *testing.T) {
		storage := &fakeStorage{resp: &resource.BackendReadResponse{
			Value: []byte(`{"metadata":{"name":"folder-uid"},"spec":{"title":"Production"}}`),
		}}
		resolver := NewResolver(storage)

		title, err := resolver.Title(context.Background(), "ns-1", "folder-uid")
		require.NoError(t, err)
		assert.Equal(t, "Production", title)
	})

	t.Run("reads the folder resource by group/resource/namespace/name", func(t *testing.T) {
		storage := &fakeStorage{resp: &resource.BackendReadResponse{
			Value: []byte(`{"spec":{"title":"Production"}}`),
		}}
		resolver := NewResolver(storage)

		_, err := resolver.Title(context.Background(), "ns-1", "folder-uid")
		require.NoError(t, err)
		require.NotNil(t, storage.reqSeen)
		assert.Equal(t, "folder.grafana.app", storage.reqSeen.Key.Group)
		assert.Equal(t, "folders", storage.reqSeen.Key.Resource)
		assert.Equal(t, "ns-1", storage.reqSeen.Key.Namespace)
		assert.Equal(t, "folder-uid", storage.reqSeen.Key.Name)
	})

	t.Run("malformed value returns an error", func(t *testing.T) {
		storage := &fakeStorage{resp: &resource.BackendReadResponse{
			Value: []byte(`{not json`),
		}}
		resolver := NewResolver(storage)

		title, err := resolver.Title(context.Background(), "ns-1", "folder-uid")
		require.Error(t, err)
		assert.Empty(t, title)
	})
}
