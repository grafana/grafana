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
