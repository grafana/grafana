package kv

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func testBlobKey(namespace string) BlobKey {
	return BlobKey{Group: "dashboard.grafana.app", Resource: "snapshots", Namespace: namespace, Name: "snap-1", UID: "blob-1"}
}

func TestBlobKeyString(t *testing.T) {
	for _, tc := range []struct {
		name string
		key  BlobKey
		want string
	}{
		{name: "namespaced", key: testBlobKey("default"), want: "dashboard.grafana.app/snapshots/default/snap-1/blob-1"},
		{name: "cluster-scoped", key: testBlobKey(""), want: "dashboard.grafana.app/snapshots//snap-1/blob-1"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, tc.key.String())
		})
	}
}

func TestParseBlobKey(t *testing.T) {
	for _, tc := range []struct {
		name    string
		key     string
		want    BlobKey
		wantErr bool
	}{
		{name: "namespaced", key: testBlobKey("default").String(), want: testBlobKey("default")},
		{name: "cluster-scoped", key: testBlobKey("").String(), want: testBlobKey("")},
		{name: "missing group", key: "/snapshots/default/snap-1/blob-1", wantErr: true},
		{name: "missing resource", key: "dashboard.grafana.app//default/snap-1/blob-1", wantErr: true},
		{name: "missing name", key: "dashboard.grafana.app/snapshots/default//blob-1", wantErr: true},
		{name: "missing uid", key: "dashboard.grafana.app/snapshots/default/snap-1/", wantErr: true},
		{name: "too few segments", key: "dashboard.grafana.app/snapshots/snap-1/blob-1", wantErr: true},
		{name: "too many segments", key: "dashboard.grafana.app/snapshots/default/snap-1/extra/blob-1", wantErr: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := ParseBlobKey(tc.key)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}
}

func TestDecodeBlobValue(t *testing.T) {
	encode := func(contentType, body string) []byte {
		return append(EncodeBlobValueHeader(contentType), body...)
	}
	for _, tc := range []struct {
		name            string
		value           []byte
		wantContentType string
		wantBody        string
		wantErr         bool
	}{
		{name: "json", value: encode("application/json", `{"a":1}`), wantContentType: "application/json", wantBody: `{"a":1}`},
		{name: "content type with parameters", value: encode("multipart/form-data; boundary=example", "--example--"), wantContentType: "multipart/form-data; boundary=example", wantBody: "--example--"},
		{name: "empty content type", value: encode("", "raw"), wantBody: "raw"},
		{name: "empty body", value: encode("text/plain", ""), wantContentType: "text/plain"},
		{name: "content type longer than one varint byte", value: encode("application/"+strings.Repeat("x", 200), "long"), wantContentType: "application/" + strings.Repeat("x", 200), wantBody: "long"},
		{name: "empty value", value: nil, wantErr: true},
		{name: "unsupported version", value: append([]byte{blobValueVersion + 1}, encode("text/plain", "body")[1:]...), wantErr: true},
		{name: "missing content type length", value: []byte{blobValueVersion}, wantErr: true},
		{name: "truncated content type length", value: []byte{blobValueVersion, 0x80}, wantErr: true},
		{name: "content type longer than the value", value: []byte{blobValueVersion, 10, 'a'}, wantErr: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			contentType, body, err := DecodeBlobValue(tc.value)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.wantContentType, contentType)
			require.Equal(t, tc.wantBody, string(body))
		})
	}
}

func TestBlobKeyFilter(t *testing.T) {
	prefixRange := func(prefix string) ListOptions {
		return ListOptions{StartKey: prefix, EndKey: PrefixRangeEnd(prefix)}
	}
	for _, tc := range []struct {
		name string
		opt  ListOptions
		want []any
	}{
		{name: "unbounded", opt: ListOptions{}},
		{name: "start key only", opt: ListOptions{StartKey: "g/r/ns/n/"}},
		{name: "partial group segment", opt: prefixRange("g")},
		{name: "group prefix", opt: prefixRange("g/"), want: []any{"g"}},
		{name: "partial name segment", opt: prefixRange("g/r/ns/na"), want: []any{"g", "r", "ns"}},
		{name: "resource prefix", opt: prefixRange("g/r/ns/n/"), want: []any{"g", "r", "ns", "n"}},
		{name: "cluster-scoped resource prefix", opt: prefixRange("g/r//n/"), want: []any{"g", "r", "", "n"}},
		{name: "full key", opt: prefixRange("g/r/ns/n/uid"), want: []any{"g", "r", "ns", "n"}},
		{name: "explicit range", opt: ListOptions{StartKey: "g/r/ns/a", EndKey: "g/r/ns/b"}, want: []any{"g", "r", "ns"}},
		{name: "too many segments", opt: prefixRange("g/r/ns/n/uid/extra/"), want: []any{"g", "r", "ns", "n"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cols, args := blobKeyFilter(tc.opt)
			require.Equal(t, tc.want, args)
			if len(tc.want) == 0 {
				require.Empty(t, cols)
				return
			}
			require.Equal(t, blobKeyColumns[:len(tc.want)], cols)
		})
	}
}
