package dashboard

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	apirequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/generic/registry"

	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestDashboardReadStorageGet(t *testing.T) {
	tests := []struct {
		name    string
		value   string
		invalid bool
	}{
		{name: "spaces and parentheses", value: "Player Resolver (ext_proc)", invalid: true},
		{name: "empty", invalid: true},
		{name: "slash", value: "invalid/name", invalid: true},
		{name: "percent", value: "invalid%name", invalid: true},
		{name: "too long", value: strings.Repeat("a", 254), invalid: true},
		{name: "valid UID", value: "123_valid-name"},
		{name: "valid punctuation", value: "valid.name:with-punctuation"},
		{name: "maximum length", value: strings.Repeat("a", 253)},
		{name: "previously reserved name remains readable", value: "history"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			keyCalled := false
			lookupErr := apierrors.NewNotFound(schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}, tt.value)
			store := dashboardReadStorage{Store: &registry.Store{
				NewFunc: func() runtime.Object { return &unstructured.Unstructured{} },
				KeyFunc: func(ctx context.Context, name string) (string, error) {
					keyCalled = true
					require.Equal(t, tt.value, name)
					return "", lookupErr
				},
			}}

			obj, err := store.Get(t.Context(), tt.value, &metav1.GetOptions{})
			require.Nil(t, obj)
			if tt.invalid {
				require.True(t, apierrors.IsBadRequest(err), "expected BadRequest, got: %v", err)
				require.ErrorContains(t, err, "Name parameter invalid:")
				require.ErrorContains(t, err, tt.value)
				require.False(t, keyCalled, "invalid names must not reach the underlying store")
			} else {
				require.ErrorIs(t, err, lookupErr)
				require.True(t, keyCalled)
			}
		})
	}
}

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
