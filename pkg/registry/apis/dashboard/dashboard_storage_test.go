package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	apirequest "k8s.io/apiserver/pkg/endpoints/request"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestDashboardStorageWrapperDelete(t *testing.T) {
	// "default" maps to orgID 1, which is required by NamespaceInfoFrom.
	ctx := apirequest.WithNamespace(context.Background(), "default")

	newWrapper := func(features featuremgmt.FeatureToggles, perms *acmock.MockPermissionsService) dashboardStorageWrapper {
		storage := grafanarest.NewMockStorage(t)
		storage.On("Delete", mock.Anything, "dash-uid", mock.Anything, mock.Anything).
			Return(&unstructured.Unstructured{}, false, nil)
		return dashboardStorageWrapper{
			Storage:                 storage,
			dashboardPermissionsSvc: perms,
			features:                features,
		}
	}

	t.Run("flag off deletes legacy permissions", func(t *testing.T) {
		perms := &acmock.MockPermissionsService{}
		perms.On("DeleteResourcePermissions", mock.Anything, int64(1), "dash-uid").Return(nil)
		w := newWrapper(featuremgmt.WithFeatures(), perms)

		_, _, err := w.Delete(ctx, "dash-uid", nil, &metav1.DeleteOptions{})
		require.NoError(t, err)
		perms.AssertCalled(t, "DeleteResourcePermissions", mock.Anything, int64(1), "dash-uid")
	})

	t.Run("flag on skips legacy permission deletion (handled by the afterDelete hook)", func(t *testing.T) {
		perms := &acmock.MockPermissionsService{}
		w := newWrapper(featuremgmt.WithFeatures(featuremgmt.FlagKubernetesAuthzResourcePermissionApis), perms)

		_, _, err := w.Delete(ctx, "dash-uid", nil, &metav1.DeleteOptions{})
		require.NoError(t, err)
		perms.AssertNotCalled(t, "DeleteResourcePermissions", mock.Anything, mock.Anything, mock.Anything)
	})
}
