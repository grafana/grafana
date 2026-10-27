package resource

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"testing"

	"github.com/stretchr/testify/require"
	"gocloud.dev/blob/memblob"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestCDKBlobStreamingRoundTrip(t *testing.T) {
	bucket := memblob.OpenBucket(nil)
	store, err := NewCDKBlobSupport(t.Context(), CDKBlobSupportOptions{Bucket: bucket})
	require.NoError(t, err)
	key := &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "snapshots", Namespace: "default", Name: "snap-1"}
	value := bytes.Repeat([]byte("streaming blob"), 400_000)
	hash := md5.Sum(value) // #nosec G401 nosemgrep: go.lang.security.audit.crypto.use_of_weak_crypto.use-of-md5

	rsp, err := store.(StreamingBlobSupport).PutResourceBlobStream(t.Context(), &resourcepb.PutBlobRequest{
		Resource: key, ContentType: "image/png", Method: resourcepb.PutBlobRequest_GRPC,
	}, bytes.NewReader(value))
	require.NoError(t, err)
	require.Equal(t, int64(len(value)), rsp.Size)
	require.Equal(t, hex.EncodeToString(hash[:]), rsp.Hash)
	require.Equal(t, "image/png", rsp.MimeType)
	_, isV7 := uuidV7Time(rsp.Uid)
	require.True(t, isV7)

	path := "default/dashboard.grafana.app/snapshots/snap-1/" + rsp.Uid + ".png"
	stored, err := bucket.ReadAll(t.Context(), path)
	require.NoError(t, err)
	require.Equal(t, value, stored)

	var downloaded bytes.Buffer
	info := &utils.BlobInfo{UID: rsp.Uid, MimeType: rsp.MimeType}
	err = store.(StreamingBlobSupport).GetResourceBlobStream(t.Context(), key, info, func(contentType string) (io.Writer, error) {
		require.Equal(t, "image/png", contentType)
		return &downloaded, nil
	})
	require.NoError(t, err)
	require.Equal(t, value, downloaded.Bytes())

	unary, err := store.GetResourceBlob(t.Context(), key, info, true)
	require.NoError(t, err)
	require.Equal(t, value, unary.Value)

	previous, err := store.PutResourceBlob(t.Context(), &resourcepb.PutBlobRequest{
		Resource: key, ContentType: "image/png", Value: []byte("unary blob"),
	})
	require.NoError(t, err)
	downloaded.Reset()
	err = store.(StreamingBlobSupport).GetResourceBlobStream(t.Context(), key, &utils.BlobInfo{UID: previous.Uid, MimeType: previous.MimeType}, func(contentType string) (io.Writer, error) {
		require.Equal(t, "image/png", contentType)
		return &downloaded, nil
	})
	require.NoError(t, err)
	require.Equal(t, "unary blob", downloaded.String())
}

func TestCDKBlobStreamingThroughResourceClient(t *testing.T) {
	bucket := memblob.OpenBucket(nil)
	store, err := NewCDKBlobSupport(t.Context(), CDKBlobSupportOptions{Bucket: bucket})
	require.NoError(t, err)
	srv, _, _ := newBlobAuthzTestServer(t, nil)
	srv.blob = store
	client := NewLocalResourceClient(srv)
	ctx := ctxWithUserInNs("default")
	key := &resourcepb.ResourceKey{Group: "playlist.grafana.app", Resource: "playlists", Namespace: "default", Name: "stream"}
	value := bytes.Repeat([]byte("x"), 5<<20)

	put, err := client.PutBlob(ctx, &resourcepb.PutBlobRequest{Resource: key, ContentType: "image/png", Value: value})
	require.NoError(t, err)
	require.Nil(t, put.Error)
	require.Equal(t, int64(len(value)), put.Size)
	path := "default/playlist.grafana.app/playlists/stream/" + put.Uid + ".png"
	stored, err := bucket.ReadAll(ctx, path)
	require.NoError(t, err)
	require.Equal(t, value, stored)

	created, err := srv.Create(ctx, &resourcepb.CreateRequest{
		Key:   key,
		Value: []byte(fmt.Sprintf(`{"apiVersion":"playlist.grafana.app/v0alpha1","kind":"Playlist","metadata":{"name":"stream","namespace":"default","annotations":{"grafana.app/blob":"%s; size=%d; mime=image/png"}},"blobs":{"image":{"uid":"%s","size":%d,"contentType":"image/png"}},"spec":{"title":"test","interval":"5m","items":[]}}`, put.Uid, put.Size, put.Uid, put.Size)),
	})
	require.NoError(t, err)
	require.Nil(t, created.Error)

	get, err := client.GetBlob(ctx, &resourcepb.GetBlobRequest{Resource: key, Uid: put.Uid, MustProxyBytes: true})
	require.NoError(t, err)
	require.Nil(t, get.Error)
	require.Equal(t, value, get.Value)
}

func TestCDKBlobStreamingErrors(t *testing.T) {
	bucket := memblob.OpenBucket(nil)
	store, err := NewCDKBlobSupport(t.Context(), CDKBlobSupportOptions{Bucket: bucket})
	require.NoError(t, err)
	streaming := store.(StreamingBlobSupport)
	key := &resourcepb.ResourceKey{Group: "g", Resource: "r", Namespace: "ns", Name: "name"}
	failure := errors.New("interrupted upload")

	_, err = streaming.PutResourceBlobStream(t.Context(), &resourcepb.PutBlobRequest{Resource: key, ContentType: "image/png"}, &failingReader{err: failure})
	require.ErrorIs(t, err, failure)
	_, err = bucket.List(nil).Next(t.Context())
	require.ErrorIs(t, err, io.EOF)

	opened := false
	open := func(string) (io.Writer, error) { opened = true; return io.Discard, nil }
	err = streaming.GetResourceBlobStream(t.Context(), key, &utils.BlobInfo{UID: "missing", MimeType: "image/png"}, open)
	require.Error(t, err)
	require.False(t, opened)

	rsp, err := streaming.PutResourceBlobStream(t.Context(), &resourcepb.PutBlobRequest{Resource: key, ContentType: "image/png"}, bytes.NewReader([]byte("image")))
	require.NoError(t, err)
	err = streaming.GetResourceBlobStream(t.Context(), key, &utils.BlobInfo{UID: rsp.Uid, MimeType: rsp.MimeType}, func(string) (io.Writer, error) { return nil, failure })
	require.ErrorIs(t, err, failure)
}

type failingReader struct{ err error }

func (r *failingReader) Read([]byte) (int, error) { return 0, r.err }
