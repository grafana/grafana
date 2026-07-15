package builders

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestSnapshotDocumentBuilder(t *testing.T) {
	builder := &SnapshotDocumentBuilder{}
	key := &resourcepb.ResourceKey{Namespace: "default", Group: dashv0.GROUP, Resource: "snapshots", Name: "snap-1"}

	value := []byte(`{
		"apiVersion": "dashboard.grafana.app/v0alpha1",
		"kind": "Snapshot",
		"metadata": {
			"name": "snap-1",
			"creationTimestamp": "2023-11-14T22:13:20Z",
			"annotations": {"grafana.app/createdBy": "user:u42"}
		},
		"spec": {
			"title": "My Snapshot",
			"expires": 1700000000000,
			"external": true,
			"externalUrl": "http://ext/snap-1",
			"deleteKey": "secret-delete-key",
			"dashboard": {"panels": [{"id": 1}], "big": "payload"}
		}
	}`)

	doc, err := builder.BuildDocument(context.Background(), key, 42, value)
	require.NoError(t, err)

	require.Equal(t, "My Snapshot", doc.Title)
	require.Equal(t, "user:u42", doc.CreatedBy, "createdBy must be indexed for RBAC scoping")
	require.Equal(t, int64(1700000000000), doc.Fields[SNAPSHOT_EXPIRES])
	require.Equal(t, true, doc.Fields[SNAPSHOT_EXTERNAL])
	require.Equal(t, "http://ext/snap-1", doc.Fields[SNAPSHOT_EXTERNAL_URL])
	require.Contains(t, doc.Fields, SNAPSHOT_CREATED)

	// The body and deleteKey must never leak into the index document.
	for k, v := range doc.Fields {
		b, _ := json.Marshal(v)
		require.NotContains(t, string(b), "secret-delete-key", "deleteKey leaked into field %q", k)
		require.NotContains(t, string(b), "payload", "dashboard body leaked into field %q", k)
	}
}

func TestSnapshotBuilder_Registration(t *testing.T) {
	info, err := SnapshotBuilder()
	require.NoError(t, err)
	require.Equal(t, dashv0.SnapshotResourceInfo.GroupResource(), info.GroupResource)
	require.NotNil(t, info.Builder)
	require.NotNil(t, info.SearchFieldsProvider)
	require.NotEmpty(t, info.SearchFieldsHash)
}
