package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	apirequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

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

func TestDashboardStorageWrapperUpdateAnnouncesOnlyAChange(t *testing.T) {
	// "default" maps to orgID 1, which is required by NamespaceInfoFrom.
	ctx := apirequest.WithNamespace(context.Background(), "default")

	dashboard := func(rv string) *unstructured.Unstructured {
		u := &unstructured.Unstructured{}
		u.SetName("dash-uid")
		u.SetResourceVersion(rv)
		return u
	}

	// The mock storage behaves like a store: it hands the stored object to the update info (when
	// there is one) and answers with what it stored.
	update := func(t *testing.T, stored, answer *unstructured.Unstructured, created bool) []string {
		storage := grafanarest.NewMockStorage(t)
		storage.On("Update", mock.Anything, "dash-uid", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
			Run(func(args mock.Arguments) {
				if stored != nil {
					_, err := args.Get(2).(rest.UpdatedObjectInfo).UpdatedObject(ctx, stored)
					require.NoError(t, err)
				}
			}).
			Return(answer, created, nil)
		channel := &recordingDashboardChannel{}
		w := dashboardStorageWrapper{Storage: storage, live: channel}

		_, _, err := w.Update(ctx, "dash-uid", rest.DefaultUpdatedObjectInfo(dashboard("")), nil, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)
		return channel.saved
	}

	t.Run("an update that changed nothing is not announced", func(t *testing.T) {
		require.Empty(t, update(t, dashboard("1"), dashboard("1"), false))
	})

	t.Run("an update that changed the dashboard is announced", func(t *testing.T) {
		require.Equal(t, []string{"default/dash-uid@2"}, update(t, dashboard("1"), dashboard("2"), false))
	})

	t.Run("a dashboard the update created is announced", func(t *testing.T) {
		require.Equal(t, []string{"default/dash-uid@1"}, update(t, dashboard(""), dashboard("1"), true))
	})

	t.Run("an update whose stored object is unknown is announced", func(t *testing.T) {
		require.Equal(t, []string{"default/dash-uid@1"}, update(t, nil, dashboard("1"), false))
	})
}

type recordingDashboardChannel struct {
	saved []string
}

func (c *recordingDashboardChannel) DashboardSaved(ns string, uid string, rv string) error {
	c.saved = append(c.saved, ns+"/"+uid+"@"+rv)
	return nil
}

func (c *recordingDashboardChannel) DashboardDeleted(ns string, uid string) error {
	return nil
}
