package v0alpha1

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSnapshotBlobReferenceRoundTrip(t *testing.T) {
	tests := []struct {
		name string
		data string
		uid  string
	}{
		{
			name: "dashboard blob reference",
			data: `{"apiVersion":"dashboard.grafana.app/v0alpha1","kind":"Snapshot","metadata":{"name":"snap-1"},"spec":{},"blobs":{"dashboard":{"uid":"blob-123"}}}`,
			uid:  "blob-123",
		},
		{
			name: "older snapshot without blobs",
			data: `{"apiVersion":"dashboard.grafana.app/v0alpha1","kind":"Snapshot","metadata":{"name":"snap-1"},"spec":{}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var snapshot Snapshot
			require.NoError(t, json.Unmarshal([]byte(tt.data), &snapshot))

			copy := snapshot.DeepCopy()
			encoded, err := json.Marshal(copy)
			require.NoError(t, err)

			var decoded Snapshot
			require.NoError(t, json.Unmarshal(encoded, &decoded))
			if tt.uid == "" {
				require.Nil(t, decoded.Blobs.Dashboard)
			} else {
				require.NotNil(t, decoded.Blobs.Dashboard)
				require.Equal(t, tt.uid, decoded.Blobs.Dashboard.Uid)
			}
		})
	}
}

func TestSnapshotGetExternalDeleteURL(t *testing.T) {
	for _, tc := range []struct{ name, externalURL, deleteKey, want string }{
		{"root", "https://example.com/dashboard/snapshot/public", "secret", "https://example.com/api/snapshots-delete/secret"},
		{"subpath", "https://example.com/grafana/dashboard/snapshot/public?orgId=1#view", "secret", "https://example.com/grafana/api/snapshots-delete/secret"},
		{"missing key", "https://example.com/dashboard/snapshot/public", "", ""},
		{"invalid URL", ":invalid", "secret", ""},
		{"relative URL", "/dashboard/snapshot/public", "secret", ""},
		{"unexpected path", "https://example.com/other", "secret", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			snap := &Snapshot{Spec: SnapshotSpec{ExternalUrl: &tc.externalURL, DeleteKey: &tc.deleteKey}}
			require.Equal(t, tc.want, snap.GetExternalDeleteURL())
			require.Empty(t, snap.Annotations)
		})
	}
	require.Empty(t, (&Snapshot{}).GetExternalDeleteURL())
}
