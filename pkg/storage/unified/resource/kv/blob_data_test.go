package kv

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBlobKeyRoundTrip(t *testing.T) {
	for _, contentType := range []string{"application/json", "text/plain; charset=utf-8", "a~b/c", ""} {
		t.Run(contentType, func(t *testing.T) {
			key := BlobKey{Group: "dashboard.grafana.app", Resource: "snapshots", Namespace: "default", Name: "snap-1", UID: "blob-1", ContentType: contentType}
			parsed, err := ParseBlobKey(key.String())
			require.NoError(t, err)
			require.Equal(t, key, parsed)
			require.Len(t, strings.Split(key.String(), "/"), 5)
		})
	}

	_, err := ParseBlobKey("dashboard.grafana.app/snapshots/default/snap-1/blob-1")
	require.Error(t, err)
}

func TestBlobKeyClusterScoped(t *testing.T) {
	key := BlobKey{Group: "dashboard.grafana.app", Resource: "snapshots", Name: "snap-1", UID: "blob-1", ContentType: "text/plain"}
	require.Equal(t, "dashboard.grafana.app/snapshots//snap-1/blob-1~text%2Fplain", key.String())

	parsed, err := ParseBlobKey(key.String())
	require.NoError(t, err)
	require.Equal(t, key, parsed)

	prefix, ok := parseBlobUIDPrefix(key.UIDPrefix())
	require.True(t, ok)
	require.Equal(t, BlobKey{Group: key.Group, Resource: key.Resource, Name: key.Name, UID: key.UID}, prefix)
}

func TestParseBlobKeyRejectsMissingSegments(t *testing.T) {
	for _, key := range []string{
		"/snapshots/default/snap-1/blob-1~text%2Fplain",
		"dashboard.grafana.app//default/snap-1/blob-1~text%2Fplain",
		"dashboard.grafana.app/snapshots/default//blob-1~text%2Fplain",
		"dashboard.grafana.app/snapshots/default/snap-1/~text%2Fplain",
	} {
		_, err := ParseBlobKey(key)
		require.Error(t, err, key)
	}
}
