package kv

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func testBlobKey(namespace, contentType string) BlobKey {
	return BlobKey{Group: "dashboard.grafana.app", Resource: "snapshots", Namespace: namespace, Name: "snap-1", UID: "blob-1", ContentType: contentType}
}

func TestBlobKeyString(t *testing.T) {
	for _, tc := range []struct {
		name string
		key  BlobKey
		want string
	}{
		{name: "namespaced", key: testBlobKey("default", "text/plain"), want: "dashboard.grafana.app/snapshots/default/snap-1/blob-1~text%2Fplain"},
		{name: "cluster-scoped", key: testBlobKey("", "text/plain"), want: "dashboard.grafana.app/snapshots//snap-1/blob-1~text%2Fplain"},
		{name: "empty content type", key: testBlobKey("default", ""), want: "dashboard.grafana.app/snapshots/default/snap-1/blob-1~"},
		{name: "content type with separators", key: testBlobKey("default", "a~b/c"), want: "dashboard.grafana.app/snapshots/default/snap-1/blob-1~a~b%2Fc"},
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
		{name: "json content type", key: testBlobKey("default", "application/json").String(), want: testBlobKey("default", "application/json")},
		{name: "content type with parameters", key: testBlobKey("default", "text/plain; charset=utf-8").String(), want: testBlobKey("default", "text/plain; charset=utf-8")},
		{name: "content type with separators", key: testBlobKey("default", "a~b/c").String(), want: testBlobKey("default", "a~b/c")},
		{name: "empty content type", key: testBlobKey("default", "").String(), want: testBlobKey("default", "")},
		{name: "cluster-scoped", key: testBlobKey("", "text/plain").String(), want: testBlobKey("", "text/plain")},
		{name: "missing content type separator", key: "dashboard.grafana.app/snapshots/default/snap-1/blob-1", wantErr: true},
		{name: "missing group", key: "/snapshots/default/snap-1/blob-1~text%2Fplain", wantErr: true},
		{name: "missing resource", key: "dashboard.grafana.app//default/snap-1/blob-1~text%2Fplain", wantErr: true},
		{name: "missing name", key: "dashboard.grafana.app/snapshots/default//blob-1~text%2Fplain", wantErr: true},
		{name: "missing uid", key: "dashboard.grafana.app/snapshots/default/snap-1/~text%2Fplain", wantErr: true},
		{name: "too few segments", key: "dashboard.grafana.app/snapshots/snap-1/blob-1~text%2Fplain", wantErr: true},
		{name: "too many segments", key: "dashboard.grafana.app/snapshots/default/snap-1/extra/blob-1~text%2Fplain", wantErr: true},
		{name: "invalid content type escape", key: "dashboard.grafana.app/snapshots/default/snap-1/blob-1~%zz", wantErr: true},
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
		{name: "partial uid segment", opt: prefixRange("g/r/ns/n/ui"), want: []any{"g", "r", "ns", "n"}},
		{name: "uid prefix", opt: prefixRange("g/r/ns/n/uid~"), want: []any{"g", "r", "ns", "n", "uid"}},
		{name: "cluster-scoped uid prefix", opt: prefixRange("g/r//n/uid~"), want: []any{"g", "r", "", "n", "uid"}},
		{name: "full key", opt: prefixRange("g/r/ns/n/uid~text%2Fplain"), want: []any{"g", "r", "ns", "n", "uid"}},
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
