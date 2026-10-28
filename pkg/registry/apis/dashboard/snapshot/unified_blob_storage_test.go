package snapshot

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"testing/synctest"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	authlib "github.com/grafana/authlib/types"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestMode1SnapshotBackgroundBlobCreate(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		service := dashboardsnapshots.NewMockService(t)
		service.On("CreateDashboardSnapshot", mock.Anything, mock.MatchedBy(func(cmd *dashboardsnapshots.CreateDashboardSnapshotCommand) bool {
			return cmd.Dashboard.Object["title"] == "CPU"
		})).Return(&dashboardsnapshots.DashboardSnapshot{
			Key: "snap-1", OrgID: 1, Dashboard: simplejson.New(),
		}, nil)
		legacy := &SnapshotLegacyStore{ResourceInfo: dashv0.SnapshotResourceInfo, Service: service, Namespacer: authlib.OrgNamespaceFormatter}
		unified := grafanarest.NewMockStorage(t)
		written := make(chan *dashv0.Snapshot, 1)
		unified.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
			Run(func(args mock.Arguments) { written <- args.Get(1).(*dashv0.Snapshot).DeepCopy() }).
			Return(&dashv0.Snapshot{}, nil).Once()
		blobs := &fakeBlobStore{putRsp: &resourcepb.PutBlobResponse{Uid: "blob-1", MimeType: "application/json"}}
		gr := dashv0.SnapshotResourceInfo.GroupResource()
		cfg := dualwrite.NewFakeConfig()
		cfg.UnifiedStorage[gr.String()] = setting.UnifiedStorageConfig{DualWriterMode: grafanarest.Mode1}
		storage, err := dualwrite.ProvideServiceForTests(cfg).NewStorage(gr, legacy, NewUnifiedBlobStorage(unified, blobs))
		require.NoError(t, err)

		ctx := identity.WithRequester(context.Background(), snapshotCreatorForTest(1))
		input := newBlobTestSnapshot()
		created, err := storage.Create(ctx, input, nil, &metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, input.Spec.Dashboard, created.(*dashv0.Snapshot).Spec.Dashboard)
		saved := <-written
		synctest.Wait()
		require.Nil(t, saved.Spec.Dashboard)
		require.Equal(t, "blob-1", saved.Blobs.Dashboard.Uid)
		require.Equal(t, "snap-1", blobs.put.Resource.Name)
		require.JSONEq(t, `{"title":"CPU","panels":[]}`, string(blobs.put.Value))
		require.Equal(t, input.Spec.Dashboard, created.(*dashv0.Snapshot).Spec.Dashboard)
	})
}

func TestUnifiedBlobStorageUploadFailureDoesNotCreate(t *testing.T) {
	unified := grafanarest.NewMockStorage(t)
	snap := newBlobTestSnapshot()
	_, err := NewUnifiedBlobStorage(unified, &fakeBlobStore{putErr: errors.New("blob upload failed")}).Create(context.Background(), snap, nil, &metav1.CreateOptions{})
	require.ErrorContains(t, err, "blob upload failed")
	require.Equal(t, "CPU", snap.Spec.Dashboard["title"])
}

func TestUnifiedBlobStorageFallbackAndSkips(t *testing.T) {
	for _, tc := range []struct {
		name    string
		prepare func(*dashv0.Snapshot)
		options *metav1.CreateOptions
		putRsp  *resourcepb.PutBlobResponse
	}{
		{name: "blob unsupported", putRsp: &resourcepb.PutBlobResponse{Error: &resourcepb.ErrorResult{Code: http.StatusNotImplemented}}},
		{name: "existing reference", prepare: func(s *dashv0.Snapshot) { s.Blobs.Dashboard = &dashv0.SnapshotBlobReference{Uid: "existing"} }},
		{name: "external", prepare: func(s *dashv0.Snapshot) { external := true; s.Spec.External = &external }},
		{name: "dry run", options: &metav1.CreateOptions{DryRun: []string{metav1.DryRunAll}}},
		{name: "generated name", prepare: func(s *dashv0.Snapshot) { s.Name = ""; s.GenerateName = "snap-" }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			snap := newBlobTestSnapshot()
			if tc.prepare != nil {
				tc.prepare(snap)
			}
			unified := grafanarest.NewMockStorage(t)
			unified.On("Create", mock.Anything, mock.MatchedBy(func(s *dashv0.Snapshot) bool {
				return s != snap && s.Spec.Dashboard != nil && ((s.Blobs.Dashboard == nil && snap.Blobs.Dashboard == nil) || (s.Blobs.Dashboard != nil && snap.Blobs.Dashboard != nil && s.Blobs.Dashboard.Uid == snap.Blobs.Dashboard.Uid))
			}), mock.Anything, mock.Anything).Return(snap, nil).Once()
			blobs := &fakeBlobStore{putRsp: tc.putRsp}
			_, err := NewUnifiedBlobStorage(unified, blobs).Create(context.Background(), snap, nil, tc.options)
			require.NoError(t, err)
			if tc.putRsp == nil {
				require.Nil(t, blobs.put)
			} else {
				require.NotNil(t, blobs.put)
			}
		})
	}
}
