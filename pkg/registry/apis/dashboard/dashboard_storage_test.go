package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/labels"
	apirequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	iamapi "github.com/grafana/grafana/pkg/registry/apis/iam"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
)

func TestDashboardStorageWrapperDelete(t *testing.T) {
	// "default" maps to orgID 1, which is required by NamespaceInfoFrom.
	ctx := apirequest.WithNamespace(context.Background(), "default")

	newWrapper := func(iamFeatures iamapi.Features, perms *acmock.MockPermissionsService) dashboardStorageWrapper {
		storage := grafanarest.NewMockStorage(t)
		storage.On("Delete", mock.Anything, "dash-uid", mock.Anything, mock.Anything).
			Return(&unstructured.Unstructured{}, false, nil)
		return dashboardStorageWrapper{
			Storage:                 storage,
			dashboardPermissionsSvc: perms,
			iamFeatures:             iamFeatures,
		}
	}

	t.Run("unavailable API deletes legacy permissions", func(t *testing.T) {
		perms := &acmock.MockPermissionsService{}
		perms.On("DeleteResourcePermissions", mock.Anything, int64(1), "dash-uid").Return(nil)
		w := newWrapper(iamapi.Features{}, perms)

		_, _, err := w.Delete(ctx, "dash-uid", nil, &metav1.DeleteOptions{})
		require.NoError(t, err)
		perms.AssertCalled(t, "DeleteResourcePermissions", mock.Anything, int64(1), "dash-uid")
	})

	t.Run("available API skips legacy permission deletion (handled by the afterDelete hook)", func(t *testing.T) {
		perms := &acmock.MockPermissionsService{}
		w := newWrapper(iamapi.Features{ResourcePermissionsAPI: true}, perms)

		_, _, err := w.Delete(ctx, "dash-uid", nil, &metav1.DeleteOptions{})
		require.NoError(t, err)
		perms.AssertNotCalled(t, "DeleteResourcePermissions", mock.Anything, mock.Anything, mock.Anything)
	})
}

func TestDashboardStorageWrapperListHidesDrafts(t *testing.T) {
	ctx := apirequest.WithNamespace(context.Background(), "default")

	listSelector := func(t *testing.T, extras DashboardLifecycleExtras, in labels.Selector) string {
		t.Helper()
		var got labels.Selector
		storage := grafanarest.NewMockStorage(t)
		storage.On("List", mock.Anything, mock.Anything).
			Run(func(args mock.Arguments) { got = args.Get(1).(*internalversion.ListOptions).LabelSelector }).
			Return(&unstructured.UnstructuredList{}, nil)
		w := dashboardStorageWrapper{Storage: storage, lifecycleExtras: extras}

		_, err := w.List(ctx, &internalversion.ListOptions{LabelSelector: in})
		require.NoError(t, err)
		return got.String()
	}

	t.Run("adds the draft exclusion when hiding", func(t *testing.T) {
		require.Equal(t, "grafana.app/lifecycle notin (draft)", listSelector(t, hideDraftsExtras{}, nil))
	})

	t.Run("include-drafts opts out and is stripped", func(t *testing.T) {
		sel, err := labels.Parse(utils.LabelKeyIncludeDrafts + "=true")
		require.NoError(t, err)
		require.Equal(t, "", listSelector(t, hideDraftsExtras{}, sel))
	})

	t.Run("leaves the selector alone when not hiding", func(t *testing.T) {
		require.Equal(t, "", listSelector(t, NoopDashboardLifecycleExtras{}, nil))
	})
}

// The apiserver decides which verbs to serve by asserting on these interfaces, so the standalone
// wrapper must keep exposing everything the raw store does.
var (
	_ rest.Watcher           = draftHidingStorage{}
	_ rest.CollectionDeleter = draftHidingStorage{}
	_ rest.Lister            = draftHidingStorage{}
)

func TestListHidingDrafts(t *testing.T) {
	ctx := apirequest.WithNamespace(context.Background(), "default")

	listSelector := func(t *testing.T, extras DashboardLifecycleExtras, in labels.Selector) string {
		t.Helper()
		var got labels.Selector
		storage := grafanarest.NewMockStorage(t)
		storage.On("List", mock.Anything, mock.Anything).
			Run(func(args mock.Arguments) { got = args.Get(1).(*internalversion.ListOptions).LabelSelector }).
			Return(&unstructured.UnstructuredList{}, nil)

		_, err := listHidingDrafts(ctx, storage, extras, &internalversion.ListOptions{LabelSelector: in})
		require.NoError(t, err)
		return got.String()
	}

	t.Run("adds the draft exclusion when hiding", func(t *testing.T) {
		require.Equal(t, "grafana.app/lifecycle notin (draft)", listSelector(t, hideDraftsExtras{}, nil))
	})

	t.Run("nil extras leaves the selector alone", func(t *testing.T) {
		require.Equal(t, "", listSelector(t, nil, nil))
	})
}
