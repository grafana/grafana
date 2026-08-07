package snapshot

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	authlib "github.com/grafana/authlib/types"
	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
)

// ctxForOrg returns a context whose namespace resolves to the given org, mirroring
// how the apiserver sets the namespace before reaching the store.
func ctxForOrg(orgID int64) context.Context {
	return k8srequest.WithNamespace(context.Background(), authlib.OrgNamespaceFormatter(orgID))
}

func TestSnapshotLegacyStore_Delete(t *testing.T) {
	makeStore := func(t *testing.T) (*SnapshotLegacyStore, *dashboardsnapshots.MockService) {
		mockService := dashboardsnapshots.NewMockService(t)
		mockService.On("GetDashboardSnapshot", mock.Anything, mock.Anything).
			Return(&dashboardsnapshots.DashboardSnapshot{
				Key:       "snap-1",
				DeleteKey: "abc123",
				OrgID:     1,
			}, nil)
		store := &SnapshotLegacyStore{
			ResourceInfo: dashV0.SnapshotResourceInfo,
			Service:      mockService,
		}
		return store, mockService
	}

	t.Run("deletes a snapshot owned by the caller's org", func(t *testing.T) {
		store, mockService := makeStore(t)
		mockService.On("DeleteDashboardSnapshot", mock.Anything, mock.Anything).Return(nil)

		_, deleted, err := store.Delete(ctxForOrg(1), "snap-1", nil, &metav1.DeleteOptions{})
		require.NoError(t, err)
		assert.True(t, deleted)
	})

	// Snapshots are org-scoped but the store looks them up by global key. A caller in
	// one org must not be able to delete a snapshot owned by another org.
	t.Run("rejects a cross-org delete with NotFound", func(t *testing.T) {
		store, mockService := makeStore(t)
		// The delete must never be reached for a cross-org target.
		mockService.On("DeleteDashboardSnapshot", mock.Anything, mock.Anything).
			Return(nil).
			Run(func(mock.Arguments) { t.Fatal("DeleteDashboardSnapshot should not be called for a cross-org snapshot") }).
			Maybe()

		// Caller is in org 2, snapshot belongs to org 1.
		_, deleted, err := store.Delete(ctxForOrg(2), "snap-1", nil, &metav1.DeleteOptions{})
		require.Error(t, err)
		assert.True(t, apierrors.IsNotFound(err), "expected NotFound, got %v", err)
		assert.False(t, deleted)
	})
}
