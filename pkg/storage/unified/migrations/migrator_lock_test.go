package migrations

import (
	"context"
	"testing"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type fakeStreamProvider struct {
	stream resourcepb.BulkStore_BulkProcessClient
	err    error
}

func (f fakeStreamProvider) createStream(_ context.Context, _ legacy.MigrateOptions) (resourcepb.BulkStore_BulkProcessClient, error) {
	return f.stream, f.err
}

type fakeBulkProcessClient struct{}

func (f fakeBulkProcessClient) Send(*resourcepb.BulkRequest) error {
	return nil
}

func (f fakeBulkProcessClient) CloseAndRecv() (*resourcepb.BulkResponse, error) {
	return &resourcepb.BulkResponse{}, nil
}

func (f fakeBulkProcessClient) Header() (metadata.MD, error) {
	return metadata.MD{}, nil
}

func (f fakeBulkProcessClient) Trailer() metadata.MD {
	return metadata.MD{}
}

func (f fakeBulkProcessClient) CloseSend() error {
	return nil
}

func (f fakeBulkProcessClient) Context() context.Context {
	return context.Background()
}

func (f fakeBulkProcessClient) SendMsg(interface{}) error {
	return nil
}

func (f fakeBulkProcessClient) RecvMsg(interface{}) error {
	return nil
}

func TestUnifiedMigrationLocksTables(t *testing.T) {
	folderGR := schema.GroupResource{Group: v1beta1.GROUP, Resource: v1beta1.FOLDER_RESOURCE}
	dashboardGR := schema.GroupResource{Group: v1beta1.GROUP, Resource: v1beta1.DASHBOARD_RESOURCE}
	resources := []schema.GroupResource{folderGR, dashboardGR}
	lockTables := []string{"folder", "dashboard"}

	unlockCalled := false
	unlockFunc := func() error {
		unlockCalled = true
		return nil
	}

	accessor := legacy.NewMockMigrationDashboardAccessor(t)
	accessor.EXPECT().LockMigrationTables(mock.Anything, lockTables).Return(unlockFunc, nil)
	accessor.EXPECT().MigrateFolders(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)
	accessor.EXPECT().MigrateDashboards(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)

	migrator := &unifiedMigration{
		MigrationDashboardAccessor: accessor,
		streamProvider: fakeStreamProvider{
			stream: fakeBulkProcessClient{},
		},
		log: log.New("test.migrations"),
	}

	_, err := migrator.Migrate(context.Background(), legacy.MigrateOptions{
		Namespace: "default",
		Resources: resources,
	})
	require.NoError(t, err)
	require.True(t, unlockCalled)
}
