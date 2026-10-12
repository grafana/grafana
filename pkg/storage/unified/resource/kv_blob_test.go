package resource

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var testBlobResourceKey = &resourcepb.ResourceKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "snapshots", Name: "snap-1"}

func TestKVBlobSupportRoundTrip(t *testing.T) {
	for _, tc := range []struct {
		name        string
		contentType string
	}{
		{name: "json", contentType: "application/json"},
		{name: "content type with extra parameters", contentType: "multipart/form-data; boundary=example"},
		{name: "content type with mixed case", contentType: "Text/Plain; Charset=UTF-8"},
		{name: "empty content type", contentType: ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := NewKVBlobSupport(setupBadgerKV(t))
			uid := writeTestBlob(t, store, tc.contentType, "payload")

			rsp, err := store.GetResourceBlob(t.Context(), testBlobResourceKey, &utils.BlobInfo{UID: uid}, true)
			require.NoError(t, err)
			require.Nil(t, rsp.Error)
			require.Equal(t, "payload", string(rsp.Value))
			require.Equal(t, tc.contentType, rsp.ContentType)
		})
	}
}

func TestKVBlobSupportPutRejectsInvalidRequests(t *testing.T) {
	for _, tc := range []struct {
		name     string
		req      *resourcepb.PutBlobRequest
		wantCode int32
	}{
		{name: "signed url upload", req: &resourcepb.PutBlobRequest{Resource: testBlobResourceKey, Method: resourcepb.PutBlobRequest_HTTP, Value: []byte("x")}, wantCode: http.StatusNotImplemented},
		{name: "empty content", req: &resourcepb.PutBlobRequest{Resource: testBlobResourceKey, Method: resourcepb.PutBlobRequest_GRPC}, wantCode: http.StatusBadRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rsp, err := NewKVBlobSupport(setupBadgerKV(t)).PutResourceBlob(t.Context(), tc.req)
			require.NoError(t, err)
			requireErrorCode(t, tc.wantCode, rsp.Error)
		})
	}
}

func TestKVBlobSupportGetRejectsInvalidRequests(t *testing.T) {
	otherResourceKey := &resourcepb.ResourceKey{Namespace: "default", Group: "dashboard.grafana.app", Resource: "snapshots", Name: "snap-2"}
	for _, tc := range []struct {
		name          string
		key           *resourcepb.ResourceKey
		info          *utils.BlobInfo
		useWrittenUID bool
		wantCode      int32
	}{
		{name: "missing blob info", key: testBlobResourceKey, wantCode: http.StatusBadRequest},
		{name: "missing uid", key: testBlobResourceKey, info: &utils.BlobInfo{}, wantCode: http.StatusBadRequest},
		{name: "unknown uid", key: testBlobResourceKey, info: &utils.BlobInfo{UID: "unknown"}, wantCode: http.StatusNotFound},
		{name: "blob of another resource", key: otherResourceKey, useWrittenUID: true, wantCode: http.StatusNotFound},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := NewKVBlobSupport(setupBadgerKV(t))
			uid := writeTestBlob(t, store, "text/plain", "payload")
			info := tc.info
			if tc.useWrittenUID {
				info = &utils.BlobInfo{UID: uid}
			}

			rsp, err := store.GetResourceBlob(t.Context(), tc.key, info, true)
			require.NoError(t, err)
			requireErrorCode(t, tc.wantCode, rsp.Error)
		})
	}
}

func writeTestBlob(t *testing.T, store BlobSupport, contentType, value string) string {
	t.Helper()
	rsp, err := store.PutResourceBlob(t.Context(), &resourcepb.PutBlobRequest{
		Resource:    testBlobResourceKey,
		Method:      resourcepb.PutBlobRequest_GRPC,
		ContentType: contentType,
		Value:       []byte(value),
	})
	require.NoError(t, err)
	require.Nil(t, rsp.Error)
	require.Equal(t, int64(len(value)), rsp.Size)
	return rsp.Uid
}

func requireErrorCode(t *testing.T, want int32, got *resourcepb.ErrorResult) {
	t.Helper()
	require.NotNil(t, got)
	require.Equal(t, want, got.Code)
}
