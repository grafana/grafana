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
	"k8s.io/apiserver/pkg/registry/rest"

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

	t.Run("toggle on, annotation set (non-'true' value), name exists -> plain 409, annotation still stripped", func(t *testing.T) {
		storage := grafanarest.NewMockStorage(t)
		obj := newObj("dash-uid", true)
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		meta.SetAnnotation(utils.AnnoKeyOverwriteExisting, "false")
		storage.On("Create", mock.Anything, obj, mock.Anything, mock.Anything).
			Return(nil, apierrors.NewAlreadyExists(dashv2beta1Resource(), "dash-uid"))
		w := dashboardStorageWrapper{Storage: storage, features: featuremgmt.WithFeatures(featuremgmt.FlagDashboardOverwriteOnCreate)}

		_, err = w.Create(ctx, obj, noValidation, &metav1.CreateOptions{})
		require.True(t, apierrors.IsAlreadyExists(err))
		require.Equal(t, "", meta.GetAnnotation(utils.AnnoKeyOverwriteExisting))
	})

	t.Run("toggle on, annotation set, name free -> Get 404s then normal create, annotation stripped", func(t *testing.T) {
		storage := grafanarest.NewMockStorage(t)
		obj := newObj("dash-uid", true)
		storage.On("Get", mock.Anything, "dash-uid", mock.Anything).
			Return(nil, apierrors.NewNotFound(dashv2beta1Resource(), "dash-uid"))
		storage.On("Create", mock.Anything, obj, mock.Anything, mock.Anything).
			Return(obj, nil)
		w := dashboardStorageWrapper{Storage: storage, features: featuremgmt.WithFeatures(featuremgmt.FlagDashboardOverwriteOnCreate)}

		out, err := w.Create(ctx, obj, noValidation, &metav1.CreateOptions{})
		require.NoError(t, err)
		require.Same(t, obj, out)
		meta, _ := utils.MetaAccessor(obj)
		require.Equal(t, "", meta.GetAnnotation(utils.AnnoKeyOverwriteExisting))
	})

	t.Run("toggle on, annotation set, existing editable dashboard -> overwritten via Update, no Create attempted", func(t *testing.T) {
		storage := grafanarest.NewMockStorage(t)
		obj := newObj("dash-uid", true)
		old := existing(false, false)
		storage.On("Get", mock.Anything, "dash-uid", mock.Anything).
			Return(old, nil)
		storage.On("Update", mock.Anything, "dash-uid", mock.Anything, mock.Anything, mock.Anything, false, mock.Anything).
			Return(obj, false, nil)
		w := dashboardStorageWrapper{Storage: storage, features: featuremgmt.WithFeatures(featuremgmt.FlagDashboardOverwriteOnCreate)}

		out, err := w.Create(ctx, obj, noValidation, &metav1.CreateOptions{})
		require.NoError(t, err)
		require.Same(t, obj, out)
		storage.AssertCalled(t, "Update", mock.Anything, "dash-uid", mock.Anything, mock.Anything, mock.Anything, false, mock.Anything)
		storage.AssertNotCalled(t, "Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("toggle on, annotation set, existing provisioning-locked dashboard -> rejected, no Update attempted", func(t *testing.T) {
		storage := grafanarest.NewMockStorage(t)
		obj := newObj("dash-uid", true)
		old := existing(true, false) // managed, AllowsEdits: false
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
		storage.On("Get", mock.Anything, "dash-uid", mock.Anything).
			Return(old, nil)
		storage.On("Update", mock.Anything, "dash-uid", mock.Anything, mock.Anything, mock.Anything, false, mock.Anything).
			Return(nil, false, forbidden)
		w := dashboardStorageWrapper{Storage: storage, features: featuremgmt.WithFeatures(featuremgmt.FlagDashboardOverwriteOnCreate)}

		_, err := w.Create(ctx, obj, noValidation, &metav1.CreateOptions{})
		require.True(t, apierrors.IsForbidden(err))
	})

	t.Run("toggle on, annotation set, existing dashboard but caller can't even read it -> Forbidden propagates, not masked as 409", func(t *testing.T) {
		storage := grafanarest.NewMockStorage(t)
		obj := newObj("dash-uid", true)
		forbidden := apierrors.NewForbidden(dashv2beta1Resource(), "dash-uid", nil)
		storage.On("Get", mock.Anything, "dash-uid", mock.Anything).
			Return(nil, forbidden)
		w := dashboardStorageWrapper{Storage: storage, features: featuremgmt.WithFeatures(featuremgmt.FlagDashboardOverwriteOnCreate)}

		_, err := w.Create(ctx, obj, noValidation, &metav1.CreateOptions{})
		require.True(t, apierrors.IsForbidden(err), "expected the real Get error, got: %v", err)
		storage.AssertNotCalled(t, "Update", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
		storage.AssertNotCalled(t, "Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})
}

func TestDashboardStorageWrapperUpdateStripsOverwriteAnnotation(t *testing.T) {
	ctx := apirequest.WithNamespace(context.Background(), "default")

	obj := &unstructured.Unstructured{Object: map[string]interface{}{
		"spec": map[string]interface{}{"title": "resent config"},
	}}
	obj.SetName("dash-uid")
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	meta.SetAnnotation(utils.AnnoKeyOverwriteExisting, "true")

	storage := grafanarest.NewMockStorage(t)
	storage.On("Update", mock.Anything, "dash-uid", mock.MatchedBy(func(info rest.UpdatedObjectInfo) bool {
		updated, uErr := info.UpdatedObject(ctx, nil)
		if uErr != nil {
			return false
		}
		m, mErr := utils.MetaAccessor(updated)
		return mErr == nil && m.GetAnnotation(utils.AnnoKeyOverwriteExisting) == ""
	}), mock.Anything, mock.Anything, false, mock.Anything).
		Return(obj, false, nil)
	w := dashboardStorageWrapper{Storage: storage, features: featuremgmt.WithFeatures()}

	_, _, err = w.Update(ctx, "dash-uid", rest.DefaultUpdatedObjectInfo(obj), noValidation,
		func(ctx context.Context, obj, old runtime.Object) error { return nil }, false, &metav1.UpdateOptions{})
	require.NoError(t, err)
}

func noValidation(ctx context.Context, obj runtime.Object) error { return nil }

func dashv2beta1Resource() schema.GroupResource {
	return schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
}
