package snapshot

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

func TestPublicSnapshotLookupErrors(t *testing.T) {
	for _, tc := range []struct {
		name, namespace string
		getErr          error
		fallback        bool
		listErr         error
	}{
		{name: "explicit namespace stays scoped", namespace: "org-3", getErr: apierrors.NewNotFound(dashv0.SnapshotResourceInfo.GroupResource(), "missing")},
		{name: "get error propagates", namespace: "default", getErr: apierrors.NewForbidden(dashv0.SnapshotResourceInfo.GroupResource(), "missing", nil)},
		{name: "missing globally", namespace: "default", getErr: apierrors.NewNotFound(dashv0.SnapshotResourceInfo.GroupResource(), "missing"), fallback: true},
		{name: "list error propagates", namespace: "default", getErr: apierrors.NewNotFound(dashv0.SnapshotResourceInfo.GroupResource(), "missing"), fallback: true, listErr: apierrors.NewServiceUnavailable("storage unavailable")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := grafanarest.NewMockStorage(t)
			store.On("Get", mock.Anything, "missing", mock.Anything).Return(nil, tc.getErr)
			if tc.fallback {
				store.On("List", mock.Anything, mock.Anything).Return(&dashv0.SnapshotList{}, tc.listErr)
			}
			ctx := k8srequest.WithNamespace(t.Context(), tc.namespace)
			_, err := getPublicSnapshot(ctx, store, "missing", &metav1.GetOptions{})
			expected := tc.getErr
			if tc.listErr != nil {
				expected = tc.listErr
			}
			require.ErrorIs(t, err, expected)
		})
	}
}

func TestPublicSnapshotLookupOutsideDefaultNamespace(t *testing.T) {
	for _, dashboard := range []bool{false, true} {
		t.Run(map[bool]string{false: "metadata", true: "dashboard"}[dashboard], func(t *testing.T) {
			snap := newBlobTestSnapshot()
			snap.Namespace = "org-2"
			store := grafanarest.NewMockStorage(t)
			store.On("Get", mock.MatchedBy(func(ctx context.Context) bool {
				caller, err := identity.GetRequester(ctx)
				return err == nil && caller.GetNamespace() == "default" && k8srequest.NamespaceValue(ctx) == "default"
			}), snap.Name, mock.Anything).Return(nil, apierrors.NewNotFound(dashv0.SnapshotResourceInfo.GroupResource(), snap.Name))
			store.On("List", mock.MatchedBy(func(ctx context.Context) bool {
				caller, err := identity.GetRequester(ctx)
				return err == nil && caller.GetNamespace() == "*" && k8srequest.NamespaceValue(ctx) == ""
			}), mock.MatchedBy(func(opts *internalversion.ListOptions) bool {
				return opts.Limit == 100 && opts.Continue == "" && opts.FieldSelector.String() == "metadata.name="+snap.Name
			})).Return(&dashv0.SnapshotList{ListMeta: metav1.ListMeta{Continue: "next-page"}}, nil).Once()
			store.On("List", mock.Anything, mock.MatchedBy(func(opts *internalversion.ListOptions) bool {
				return opts.Continue == "next-page" && opts.FieldSelector.String() == "metadata.name="+snap.Name
			})).Return(&dashv0.SnapshotList{Items: []dashv0.Snapshot{*snap}}, nil).Once()
			ctx := k8srequest.WithNamespace(t.Context(), "default")
			if dashboard {
				r, err := NewDashboardREST(store, nil)
				require.NoError(t, err)
				_, err = r.(*dashboardREST).Connect(ctx, snap.Name, nil, &capturingResponder{})
				require.NoError(t, err)
			} else {
				r := &storageWrapper{inner: store}
				obj, err := r.Get(ctx, snap.Name, &metav1.GetOptions{})
				require.NoError(t, err)
				result := obj.(*dashv0.Snapshot)
				require.Equal(t, "org-2", result.Namespace)
				require.Nil(t, result.Spec.DeleteKey)
				require.Nil(t, result.Spec.Dashboard)
			}
		})
	}
}
