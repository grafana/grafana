package resource

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type blobValidationBackend struct {
	StorageBackend
	reads  atomic.Int64
	writes atomic.Int64
}

func (b *blobValidationBackend) Stop(ctx context.Context) error {
	return b.StorageBackend.(interface{ Stop(context.Context) error }).Stop(ctx)
}

func (b *blobValidationBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *BackendReadResponse {
	b.reads.Add(1)
	return b.StorageBackend.ReadResource(ctx, req)
}

func (b *blobValidationBackend) WriteEvent(ctx context.Context, event WriteEvent) (int64, error) {
	b.writes.Add(1)
	return b.StorageBackend.WriteEvent(ctx, event)
}

func blobValidationBody(blobs string) []byte {
	return []byte(fmt.Sprintf(`{"apiVersion":"playlist.grafana.app/v0alpha1","kind":"Playlist","metadata":{"name":"item","namespace":"default","uid":"resource-uid"},"spec":{"data":"resource-specific"}%s}`, blobs))
}

func TestResourceUpdateRejectsInlineBlobDataOnNoOp(t *testing.T) {
	var backend *blobValidationBackend
	srv, _, _ := newBlobAuthzTestServer(t, func(store StorageBackend) StorageBackend {
		backend = &blobValidationBackend{StorageBackend: store}
		return backend
	})
	ctx := ctxWithUserInNs("default")
	key := &resourcepb.ResourceKey{Group: "playlist.grafana.app", Resource: "playlists", Namespace: "default", Name: "item"}
	value := blobValidationBody(`,"blobs":{"dashboard":{"data":"e30="}}`)
	user, ok := authlib.AuthInfoFrom(ctx)
	require.True(t, ok)
	// Seed an older writer's invalid row directly so the no-op path cannot
	// bypass validation merely because its bytes match the stored body.
	event, failure := srv.newEvent(ctx, user, key, 0, value, nil)
	require.Nil(t, failure)
	rv, err := backend.WriteEvent(ctx, *event)
	require.NoError(t, err)
	reads, writes := backend.reads.Load(), backend.writes.Load()
	rsp, err := srv.Update(ctx, &resourcepb.UpdateRequest{Key: key, Value: value, ResourceVersion: rv})
	require.Nil(t, rsp)
	require.Error(t, err)
	require.EqualValues(t, http.StatusBadRequest, AsErrorResult(err).Code)
	require.Equal(t, reads, backend.reads.Load())
	require.Equal(t, writes, backend.writes.Load())
}

func TestResourceBlobValidationPreservesAuthentication(t *testing.T) {
	srv := &server{}
	key := &resourcepb.ResourceKey{Group: "playlist.grafana.app", Resource: "playlists", Namespace: "default", Name: "item"}
	value := blobValidationBody(`,"blobs":{"dashboard":{"data":"e30="}}`)
	created, err := srv.Create(t.Context(), &resourcepb.CreateRequest{Key: key, Value: value})
	require.Nil(t, created)
	require.EqualValues(t, http.StatusUnauthorized, rpcErrorResult(t, err).GetCode())
	updated, err := srv.Update(t.Context(), &resourcepb.UpdateRequest{Key: key, Value: value})
	require.Nil(t, updated)
	require.EqualValues(t, http.StatusUnauthorized, rpcErrorResult(t, err).GetCode())
}

func TestResourceWritesPreserveBlobReferences(t *testing.T) {
	srv, _, _ := newBlobAuthzTestServer(t, nil)
	ctx := ctxWithUserInNs("default")
	for i, blobs := range []string{
		"",
		`,"blobs":null`,
		`,"blobs":{}`,
		`,"blobs":{"dashboard":{"uid":"existing","contentType":"application/json","size":9007199254740993,"custom":{"data":"not inline"}}}`,
		`,"blobs":{"dashboard":null,"other":{}}`,
	} {
		t.Run(fmt.Sprintf("case-%d", i), func(t *testing.T) {
			name := fmt.Sprintf("item-%d", i)
			key := &resourcepb.ResourceKey{Group: "playlist.grafana.app", Resource: "playlists", Namespace: "default", Name: name}
			value := []byte(strings.ReplaceAll(string(blobValidationBody(blobs)), `"name":"item"`, fmt.Sprintf(`"name":%q`, name)))
			original := append([]byte(nil), value...)
			created, err := srv.Create(ctx, &resourcepb.CreateRequest{Key: key, Value: value})
			require.NoError(t, err)
			require.Positive(t, created.ResourceVersion)
			require.Equal(t, original, value)
			read, err := srv.Read(ctx, &resourcepb.ReadRequest{Key: key})
			require.NoError(t, err)
			require.JSONEq(t, string(original), string(read.Value))
			if i == 3 {
				require.Contains(t, string(read.Value), `"size":9007199254740993`)
			}

			unchanged, err := srv.Update(ctx, &resourcepb.UpdateRequest{Key: key, Value: read.Value, ResourceVersion: read.ResourceVersion})
			require.NoError(t, err)
			require.Equal(t, read.ResourceVersion, unchanged.ResourceVersion)

			updatedValue := []byte(strings.ReplaceAll(string(value), `"resource-specific"`, `"updated resource-specific"`))
			updated, err := srv.Update(ctx, &resourcepb.UpdateRequest{Key: key, Value: updatedValue, ResourceVersion: read.ResourceVersion})
			require.NoError(t, err)
			read, err = srv.Read(ctx, &resourcepb.ReadRequest{Key: key})
			require.NoError(t, err)
			require.JSONEq(t, string(updatedValue), string(read.Value))
			if i == 3 {
				require.Contains(t, string(read.Value), `"size":9007199254740993`)
			}
			require.Equal(t, updated.ResourceVersion, read.ResourceVersion)
		})
	}
}

func TestResourceWritesRejectInlineBlobData(t *testing.T) {
	var backend *blobValidationBackend
	srv, _, _ := newBlobAuthzTestServer(t, func(store StorageBackend) StorageBackend {
		backend = &blobValidationBackend{StorageBackend: store}
		return backend
	})
	ctx := ctxWithUserInNs("default")
	key := &resourcepb.ResourceKey{Group: "playlist.grafana.app", Resource: "playlists", Namespace: "default", Name: "item"}
	original := blobValidationBody(`,"blobs":{"dashboard":{"uid":"existing"}}`)
	created, err := srv.Create(ctx, &resourcepb.CreateRequest{Key: key, Value: original})
	require.NoError(t, err)

	for name, value := range map[string][]byte{
		"inline bytes":     blobValidationBody(`,"blobs":{"dashboard":{"contentType":"application/json","data":"e30="}}`),
		"empty data":       blobValidationBody(`,"blobs":{"dashboard":{"data":""}}`),
		"null data":        blobValidationBody(`,"blobs":{"dashboard":{"data":null}}`),
		"data and uid":     blobValidationBody(`,"blobs":{"dashboard":{"uid":"existing","data":"e30="}}`),
		"invalid base64":   blobValidationBody(`,"blobs":{"dashboard":{"data":"not base64"}}`),
		"duplicate entry":  blobValidationBody(`,"blobs":{"dashboard":{"data":"e30="},"dashboard":{"uid":"existing"}}`),
		"duplicate blobs":  blobValidationBody(`,"blobs":{"dashboard":{"data":"e30="}},"blobs":{"dashboard":{"uid":"existing"}}`),
		"malformed JSON":   []byte(`{"blobs":`),
		"non-object body":  []byte(`[]`),
		"trailing JSON":    append(blobValidationBody(""), []byte(` {}`)...),
		"non-object blobs": blobValidationBody(`,"blobs":[]`),
		"non-object entry": blobValidationBody(`,"blobs":{"dashboard":"inline"}`),
	} {
		for _, operation := range []string{"create", "update"} {
			t.Run(operation+"/"+name, func(t *testing.T) {
				reads, writes := backend.reads.Load(), backend.writes.Load()
				var err error
				if operation == "create" {
					createKey := proto.Clone(key).(*resourcepb.ResourceKey)
					createKey.Name = "new-item"
					createValue := []byte(strings.ReplaceAll(string(value), `"name":"item"`, `"name":"new-item"`))
					rsp, callErr := srv.Create(ctx, &resourcepb.CreateRequest{Key: createKey, Value: createValue})
					require.Nil(t, rsp)
					err = callErr
				} else {
					rsp, callErr := srv.Update(ctx, &resourcepb.UpdateRequest{Key: key, Value: value, ResourceVersion: created.ResourceVersion})
					require.Nil(t, rsp)
					err = callErr
				}
				require.Error(t, err)
				require.EqualValues(t, http.StatusBadRequest, AsErrorResult(err).Code)
				require.Equal(t, reads, backend.reads.Load(), "invalid blob input must not reach backend reads")
				require.Equal(t, writes, backend.writes.Load(), "invalid blob input must not reach backend writes")
			})
		}
	}
	read, err := srv.Read(ctx, &resourcepb.ReadRequest{Key: key})
	require.NoError(t, err)
	require.JSONEq(t, string(original), string(read.Value))
	require.Equal(t, created.ResourceVersion, read.ResourceVersion)
}
