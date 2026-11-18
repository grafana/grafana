package snapshot

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/common"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
)

func TestSnapshotCreateRejectsDryRunBeforeSideEffects(t *testing.T) {
	setKubernetesSnapshotsToggle(t, true)
	remote := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		t.Error("dry-run contacted the external server")
	}))
	t.Cleanup(remote.Close)
	for _, external := range []bool{false, true} {
		for _, query := range []string{"dryRun=All", "dryRun=invalid", "dryRun="} {
			storage := grafanarest.NewMockStorage(t)
			blobs := &fakeBlobStore{}
			routes := GetRoutes(dashv0.SnapshotSharingOptions{
				SnapshotsEnabled: true, ExternalEnabled: true, ExternalSnapshotURL: remote.URL,
			}, acmock.New().WithPermissions([]ac.Permission{{Action: dashboards.ActionSnapshotsCreate}}),
				map[string]common.OpenAPIDefinition{}, func() rest.Storage { return storage }, dashboards.NewFakeDashboardService(t), blobs, testReadFromLegacy)
			body, err := json.Marshal(map[string]any{"dashboard": map[string]any{"uid": "source"}, "external": external})
			require.NoError(t, err)
			req := httptest.NewRequest(http.MethodPost, "/snapshots/create?"+query, bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req = req.WithContext(identity.WithRequester(req.Context(), snapshotCreatorForTest(1)))
			req = mux.SetURLVars(req, map[string]string{"namespace": "default"})
			rsp := httptest.NewRecorder()
			routes.Namespace[0].Handler(rsp, req)
			require.Equal(t, http.StatusBadRequest, rsp.Code, rsp.Body.String())
			require.Contains(t, rsp.Body.String(), "dryRun is not supported")
			require.Nil(t, blobs.put)
		}
	}
}

func TestSnapshotInlineValidationBeforeStorage(t *testing.T) {
	for _, tc := range []struct {
		name   string
		mutate func(*dashv0.SnapshotBlobReference)
	}{
		{"empty", func(b *dashv0.SnapshotBlobReference) { b.Data = new("") }},
		{"invalid base64", func(b *dashv0.SnapshotBlobReference) { b.Data = new("!") }},
		{"mixed reference", func(b *dashv0.SnapshotBlobReference) { b.Uid = new("other") }},
		{"client metadata", func(b *dashv0.SnapshotBlobReference) { b.Size = new(int64(1)) }},
		{"missing content type", func(b *dashv0.SnapshotBlobReference) { b.ContentType = nil }},
		{"wrong content type", func(b *dashv0.SnapshotBlobReference) { b.ContentType = new("text/plain") }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, dryRun := range []bool{false, true} {
				input := newBlobTestSnapshot()
				tc.mutate(input.Blobs.Dashboard)
				options := &metav1.CreateOptions{}
				if dryRun {
					options.DryRun = []string{metav1.DryRunAll}
				}
				unified := NewUnifiedBlobStorage(grafanarest.NewMockStorage(t))
				_, err := unified.Create(t.Context(), input, nil, options)
				require.Error(t, err)
				legacy := &SnapshotLegacyStore{Service: dashboardsnapshots.NewMockService(t)}
				_, err = legacy.Create(t.Context(), input, nil, options)
				require.Error(t, err)
			}
		})
	}
}

func TestHistoricalSnapshotReadAndRedaction(t *testing.T) {
	var snap dashv0.Snapshot
	require.NoError(t, json.Unmarshal([]byte(`{"metadata":{"name":"old","annotations":{"kubectl.kubernetes.io/last-applied-configuration":"private","keep":"yes"}},"spec":{"dashboard":{"id":9007199254740993,"title":"old"}}}`), &snap))
	dashboard, err := loadDashboardContent(t.Context(), nil, &snap)
	require.NoError(t, err)
	require.Equal(t, json.Number("9007199254740993"), dashboard["id"])
	public, err := stripSensitiveFields(&snap)
	require.NoError(t, err)
	require.Nil(t, public.Blobs.Dashboard)
	require.Equal(t, map[string]string{"keep": "yes"}, public.Annotations)
	require.NotNil(t, snap.Blobs.Dashboard.Data)
	list, err := stripSensitiveFieldsFromList(&dashv0.SnapshotList{Items: []dashv0.Snapshot{snap}})
	require.NoError(t, err)
	require.Nil(t, list.Items[0].Blobs.Dashboard)
	require.Equal(t, public.Annotations, list.Items[0].Annotations)
	encoded, err := json.Marshal(public)
	require.NoError(t, err)
	require.NotContains(t, string(encoded), "9007199254740993")
	require.NotContains(t, string(encoded), "private")
}

func TestSnapshotUnifiedUpdateIsImmutable(t *testing.T) {
	for _, dryRun := range []bool{false, true} {
		storage := NewUnifiedBlobStorage(grafanarest.NewMockStorage(t))
		options := &metav1.UpdateOptions{}
		if dryRun {
			options.DryRun = []string{metav1.DryRunAll}
		}
		out, created, err := storage.Update(t.Context(), "snap-1", rest.DefaultUpdatedObjectInfo(newBlobTestSnapshot()), nil, nil, false, options)
		require.ErrorContains(t, err, "immutable")
		require.Nil(t, out)
		require.False(t, created)
	}
}

func TestSnapshotReferenceRedactionPreservesMetadata(t *testing.T) {
	snap := &dashv0.Snapshot{Blobs: dashv0.SnapshotBlobs{Dashboard: &dashv0.SnapshotBlobReference{
		Uid: new("blob-1"), Size: new(int64(100)), Hash: new("hash"), ContentType: new("application/json"),
	}}}
	public, err := stripSensitiveFields(snap)
	require.NoError(t, err)
	require.Equal(t, snap.Blobs, public.Blobs)
}
