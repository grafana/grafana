package snapshot

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestSnapshotInlineGeneratedName(t *testing.T) {
	client := &snapshotResourceClient{fakeBlobStore: fakeBlobStore{putRsp: &resourcepb.PutBlobResponse{Uid: "blob-1", Size: 27, Hash: "server-hash", MimeType: "application/json"}}}
	storage := newSnapshotUnifiedStorage(t, client)
	ctx := k8srequest.WithNamespace(identity.WithRequester(t.Context(), snapshotCreatorForTest(1)), "default")
	input := newBlobTestSnapshot()
	input.Name = ""
	input.GenerateName = "snapshot-"
	out, err := storage.Create(ctx, input, nil, &metav1.CreateOptions{})
	require.NoError(t, err)
	created := out.(*dashv0.Snapshot)
	require.NotEmpty(t, created.Name)
	require.Equal(t, created.Name, client.put.Resource.Name)
	require.Nil(t, created.Blobs.Dashboard.Data)
	require.Empty(t, input.Name)
}

func TestSnapshotReferenceAndExternalCreate(t *testing.T) {
	for _, external := range []bool{false, true} {
		for _, reference := range []bool{false, true} {
			if !external && !reference {
				continue
			}
			client := &snapshotResourceClient{}
			storage := newSnapshotUnifiedStorage(t, client)
			ctx := k8srequest.WithNamespace(identity.WithRequester(t.Context(), snapshotCreatorForTest(1)), "default")
			input := newBlobTestSnapshot()
			input.Spec.External = &external
			input.Spec.ExternalUrl = new("https://example.com/share/snapshot")
			if reference {
				input.Blobs.Dashboard = &dashv0.SnapshotBlobReference{Uid: new("existing"), ContentType: new("application/json")}
			}
			out, err := storage.Create(ctx, input, nil, &metav1.CreateOptions{})
			require.NoError(t, err)
			require.Nil(t, client.put)
			require.Equal(t, 1, client.writes)
			var saved dashv0.Snapshot
			require.NoError(t, json.Unmarshal(client.value, &saved))
			require.Equal(t, input.Spec, saved.Spec)
			if reference {
				require.Equal(t, input.Blobs, saved.Blobs)
				require.Equal(t, input.Blobs, out.(*dashv0.Snapshot).Blobs)
			} else {
				require.Nil(t, saved.Blobs.Dashboard)
				require.NotNil(t, input.Blobs.Dashboard.Data)
			}
		}
	}
}

func TestSnapshotHistoricalUnifiedRead(t *testing.T) {
	client := &snapshotResourceClient{value: []byte(`{"apiVersion":"dashboard.grafana.app/v0alpha1","kind":"Snapshot","metadata":{"name":"snap-1","namespace":"default"},"spec":{"dashboard":{"id":9007199254740993,"title":"old"}}}`)}
	storage := newSnapshotUnifiedStorage(t, client)
	ctx := k8srequest.WithNamespace(identity.WithRequester(t.Context(), snapshotCreatorForTest(1)), "default")
	out, err := storage.Get(ctx, "snap-1", &metav1.GetOptions{})
	require.NoError(t, err)
	dashboard, err := loadDashboardContent(ctx, nil, out.(*dashv0.Snapshot))
	require.NoError(t, err)
	require.Equal(t, json.Number("9007199254740993"), dashboard["id"])
	public, err := stripSensitiveFields(out)
	require.NoError(t, err)
	require.Nil(t, public.Blobs.Dashboard)
}

func TestSnapshotLegacyDryRun(t *testing.T) {
	store := &SnapshotLegacyStore{Service: dashboardsnapshots.NewMockService(t)}
	input := newBlobTestSnapshot()
	out, err := store.Create(t.Context(), input, nil, &metav1.CreateOptions{DryRun: []string{metav1.DryRunAll}})
	require.NoError(t, err)
	require.Nil(t, out.(*dashv0.Snapshot).Blobs.Dashboard)
	require.NotNil(t, input.Blobs.Dashboard.Data)
}
