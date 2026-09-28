package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	apirequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
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

func TestDashboardStorageWrapperCreate(t *testing.T) {
	ctx := apirequest.WithNamespace(context.Background(), "default")

	existing := func(managed bool, allowsEdits bool) *unstructured.Unstructured {
		obj := &unstructured.Unstructured{Object: map[string]interface{}{
			"spec": map[string]interface{}{"title": "existing title"},
		}}
		obj.SetName("dash-uid")
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		if managed {
			meta.SetManagerProperties(utils.ManagerProperties{
				Kind:        utils.ManagerKindRepo,
				Identity:    "test-repo",
				AllowsEdits: allowsEdits,
			})
		}
		return obj
	}

	newObj := func(name string, overwrite bool) *unstructured.Unstructured {
		obj := &unstructured.Unstructured{Object: map[string]interface{}{
			"spec": map[string]interface{}{"title": "new title"},
		}}
		obj.SetName(name)
		if overwrite {
			meta, err := utils.MetaAccessor(obj)
			require.NoError(t, err)
			meta.SetAnnotation(utils.AnnoKeyOverwriteExisting, "true")
		}
		return obj
	}

	t.Run("toggle off: annotation set, name exists -> plain 409, annotation not persisted", func(t *testing.T) {
		storage := grafanarest.NewMockStorage(t)
		obj := newObj("dash-uid", true)
		storage.On("Create", mock.Anything, obj, mock.Anything, mock.Anything).
			Return(nil, apierrors.NewAlreadyExists(dashv2beta1Resource(), "dash-uid"))
		w := dashboardStorageWrapper{Storage: storage, features: featuremgmt.WithFeatures()}

		_, err := w.Create(ctx, obj, noValidation, &metav1.CreateOptions{})
		require.True(t, apierrors.IsAlreadyExists(err))
		meta, _ := utils.MetaAccessor(obj)
		require.Equal(t, "", meta.GetAnnotation(utils.AnnoKeyOverwriteExisting))
	})

	t.Run("toggle on, no annotation, name exists -> plain 409", func(t *testing.T) {
		storage := grafanarest.NewMockStorage(t)
		obj := newObj("dash-uid", false)
		storage.On("Create", mock.Anything, obj, mock.Anything, mock.Anything).
			Return(nil, apierrors.NewAlreadyExists(dashv2beta1Resource(), "dash-uid"))
		w := dashboardStorageWrapper{Storage: storage, features: featuremgmt.WithFeatures(featuremgmt.FlagDashboardOverwriteOnCreate)}

		_, err := w.Create(ctx, obj, noValidation, &metav1.CreateOptions{})
		require.True(t, apierrors.IsAlreadyExists(err))
	})

	t.Run("toggle on, annotation set, name free -> normal create, annotation stripped", func(t *testing.T) {
		storage := grafanarest.NewMockStorage(t)
		obj := newObj("dash-uid", true)
		storage.On("Create", mock.Anything, obj, mock.Anything, mock.Anything).
			Return(obj, nil)
		w := dashboardStorageWrapper{Storage: storage, features: featuremgmt.WithFeatures(featuremgmt.FlagDashboardOverwriteOnCreate)}

		out, err := w.Create(ctx, obj, noValidation, &metav1.CreateOptions{})
		require.NoError(t, err)
		require.Same(t, obj, out)
		meta, _ := utils.MetaAccessor(obj)
		require.Equal(t, "", meta.GetAnnotation(utils.AnnoKeyOverwriteExisting))
		storage.AssertNotCalled(t, "Get", mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("toggle on, annotation set, existing editable dashboard -> overwritten via Update", func(t *testing.T) {
		storage := grafanarest.NewMockStorage(t)
		obj := newObj("dash-uid", true)
		old := existing(false, false)
		storage.On("Create", mock.Anything, obj, mock.Anything, mock.Anything).
			Return(nil, apierrors.NewAlreadyExists(dashv2beta1Resource(), "dash-uid"))
		storage.On("Get", mock.Anything, "dash-uid", mock.Anything).
			Return(old, nil)
		storage.On("Update", mock.Anything, "dash-uid", mock.Anything, mock.Anything, mock.Anything, false, mock.Anything).
			Return(obj, false, nil)
		w := dashboardStorageWrapper{Storage: storage, features: featuremgmt.WithFeatures(featuremgmt.FlagDashboardOverwriteOnCreate)}

		out, err := w.Create(ctx, obj, noValidation, &metav1.CreateOptions{})
		require.NoError(t, err)
		require.Same(t, obj, out)
		storage.AssertCalled(t, "Update", mock.Anything, "dash-uid", mock.Anything, mock.Anything, mock.Anything, false, mock.Anything)
	})

	t.Run("toggle on, annotation set, existing provisioning-locked dashboard -> rejected", func(t *testing.T) {
		storage := grafanarest.NewMockStorage(t)
		obj := newObj("dash-uid", true)
		old := existing(true, false) // managed, AllowsEdits: false
		storage.On("Create", mock.Anything, obj, mock.Anything, mock.Anything).
			Return(nil, apierrors.NewAlreadyExists(dashv2beta1Resource(), "dash-uid"))
		storage.On("Get", mock.Anything, "dash-uid", mock.Anything).
			Return(old, nil)
		w := dashboardStorageWrapper{Storage: storage, features: featuremgmt.WithFeatures(featuremgmt.FlagDashboardOverwriteOnCreate)}

		_, err := w.Create(ctx, obj, noValidation, &metav1.CreateOptions{})
		require.Error(t, err)
		require.False(t, apierrors.IsAlreadyExists(err), "should be a BadRequest, not the raw AlreadyExists")
		storage.AssertNotCalled(t, "Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("toggle on, annotation set, existing dashboard but caller lacks edit permission -> Forbidden propagates", func(t *testing.T) {
		storage := grafanarest.NewMockStorage(t)
		obj := newObj("dash-uid", true)
		old := existing(false, false)
		forbidden := apierrors.NewForbidden(dashv2beta1Resource(), "dash-uid", nil)
		storage.On("Create", mock.Anything, obj, mock.Anything, mock.Anything).
			Return(nil, apierrors.NewAlreadyExists(dashv2beta1Resource(), "dash-uid"))
		storage.On("Get", mock.Anything, "dash-uid", mock.Anything).
			Return(old, nil)
		storage.On("Update", mock.Anything, "dash-uid", mock.Anything, mock.Anything, mock.Anything, false, mock.Anything).
			Return(nil, false, forbidden)
		w := dashboardStorageWrapper{Storage: storage, features: featuremgmt.WithFeatures(featuremgmt.FlagDashboardOverwriteOnCreate)}

		_, err := w.Create(ctx, obj, noValidation, &metav1.CreateOptions{})
		require.True(t, apierrors.IsForbidden(err))
	})
}

func noValidation(ctx context.Context, obj runtime.Object) error { return nil }

func dashv2beta1Resource() schema.GroupResource {
	return schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
}
