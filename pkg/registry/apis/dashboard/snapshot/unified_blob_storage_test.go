package snapshot

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	authlib "github.com/grafana/authlib/types"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestMode1SnapshotCreateKeepsLegacyDashboardAndUploadsUnifiedBlob(t *testing.T) {
	service := dashboardsnapshots.NewMockService(t)
	service.On("CreateDashboardSnapshot", mock.Anything, mock.MatchedBy(func(cmd *dashboardsnapshots.CreateDashboardSnapshotCommand) bool {
		return cmd.Dashboard.Object["title"] == "CPU"
	})).Return(&dashboardsnapshots.DashboardSnapshot{
		Key: "snap-1", OrgID: 1, Dashboard: simplejson.New(),
	}, nil)
	legacy := &SnapshotLegacyStore{
		ResourceInfo: dashv0.SnapshotResourceInfo,
		Service:      service,
		Namespacer:   authlib.OrgNamespaceFormatter,
	}
	ctx := identity.WithRequester(context.Background(), snapshotCreatorForTest(1))
	original := newBlobTestSnapshot()
	created, err := legacy.Create(ctx, original, nil, &metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, original.Spec.Dashboard, created.(*dashv0.Snapshot).Spec.Dashboard)

	unified := grafanarest.NewMockStorage(t)
	unified.On("Create", mock.Anything, mock.MatchedBy(func(snap *dashv0.Snapshot) bool {
		return snap.Spec.Dashboard == nil && snap.Blobs.Dashboard != nil && snap.Blobs.Dashboard.Uid == "blob-1"
	}), mock.Anything, mock.Anything).Return(created, nil)
	blobs := &fakeBlobStore{putRsp: &resourcepb.PutBlobResponse{Uid: "blob-1", MimeType: "application/json"}}
	_, err = NewUnifiedBlobStorage(unified, blobs).Create(ctx, created, nil, &metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, original.Spec.Dashboard, created.(*dashv0.Snapshot).Spec.Dashboard)
	require.JSONEq(t, `{"title":"CPU","panels":[]}`, string(blobs.put.Value))
	require.Equal(t, "snap-1", blobs.put.Resource.Name)
}

func TestUnifiedBlobStorageUploadFailureDoesNotCreateResource(t *testing.T) {
	unified := grafanarest.NewMockStorage(t)
	blobs := &fakeBlobStore{putErr: errors.New("blob upload failed")}
	snap := newBlobTestSnapshot()
	_, err := NewUnifiedBlobStorage(unified, blobs).Create(context.Background(), snap, nil, &metav1.CreateOptions{})
	require.ErrorContains(t, err, "blob upload failed")
	require.Equal(t, "CPU", snap.Spec.Dashboard["title"])
}

func TestUnifiedBlobStorageSkipsUploads(t *testing.T) {
	for _, tc := range []struct {
		name    string
		prepare func(*dashv0.Snapshot)
		options *metav1.CreateOptions
	}{
		{"existing reference", func(s *dashv0.Snapshot) {
			s.Spec.Dashboard = nil
			s.Blobs.Dashboard = &dashv0.SnapshotBlobReference{Uid: "already-uploaded"}
		}, &metav1.CreateOptions{}},
		{"external snapshot", func(s *dashv0.Snapshot) {
			external := true
			s.Spec.External = &external
		}, &metav1.CreateOptions{}},
		{"dry run", func(*dashv0.Snapshot) {}, &metav1.CreateOptions{DryRun: []string{metav1.DryRunAll}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			snap := newBlobTestSnapshot()
			tc.prepare(snap)
			unified := grafanarest.NewMockStorage(t)
			unified.On("Create", mock.Anything, snap, mock.Anything, mock.Anything).Return(snap, nil)
			blobs := &fakeBlobStore{}
			_, err := NewUnifiedBlobStorage(unified, blobs).Create(context.Background(), snap, nil, tc.options)
			require.NoError(t, err)
			require.Nil(t, blobs.put)
		})
	}
}
