package snapshot

import (
	"context"
	"testing"
	"time"

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

func TestPublicSnapshotLookupOutsideDefaultNamespace(t *testing.T) {
	for _, dashboard := range []bool{false, true} {
		t.Run(map[bool]string{false: "metadata", true: "dashboard"}[dashboard], func(t *testing.T) {
			snap := newBlobTestSnapshot()
			snap.Namespace = "org-2"
			store := grafanarest.NewMockStorage(t)
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
				return
			}
			r := &storageWrapper{inner: store}
			obj, err := r.Get(ctx, snap.Name, &metav1.GetOptions{})
			require.NoError(t, err)
			result := obj.(*dashv0.Snapshot)
			require.Equal(t, "org-2", result.Namespace)
			require.Nil(t, result.Spec.DeleteKey)
			require.Nil(t, result.Spec.Dashboard)
		})
	}
}

func TestPublicSnapshotLookupRejectsAmbiguousKeys(t *testing.T) {
	first := newBlobTestSnapshot()
	first.Namespace = "org-2"
	second := first.DeepCopy()
	second.Namespace = "org-3"
	store := grafanarest.NewMockStorage(t)
	store.On("List", mock.Anything, mock.Anything).Return(&dashv0.SnapshotList{Items: []dashv0.Snapshot{*first, *second}}, nil)

	ctx := k8srequest.WithNamespace(t.Context(), "default")
	obj, err := getPublicSnapshot(ctx, store, first.Name, &metav1.GetOptions{})
	require.True(t, apierrors.IsConflict(err))
	require.Nil(t, obj)
}

func TestPublicSnapshotLookupRejectsExpiredSnapshots(t *testing.T) {
	snap := newBlobTestSnapshot()
	snap.Namespace = "org-2"
	expires := time.Now().Add(-time.Minute).UnixMilli()
	snap.Spec.Expires = &expires
	store := grafanarest.NewMockStorage(t)
	store.On("List", mock.Anything, mock.Anything).Return(&dashv0.SnapshotList{Items: []dashv0.Snapshot{*snap}}, nil)

	ctx := k8srequest.WithNamespace(t.Context(), "default")
	obj, err := getPublicSnapshot(ctx, store, snap.Name, &metav1.GetOptions{})
	require.True(t, apierrors.IsNotFound(err))
	require.Nil(t, obj)
}

func TestSnapshotLookupWithExplicitNamespaceStaysScoped(t *testing.T) {
	store := grafanarest.NewMockStorage(t)
	notFound := apierrors.NewNotFound(dashv0.SnapshotResourceInfo.GroupResource(), "missing")
	store.On("Get", mock.MatchedBy(func(ctx context.Context) bool {
		caller, err := identity.GetRequester(ctx)
		return err == nil && caller.GetNamespace() == "org-3"
	}), "missing", mock.Anything).Return(nil, notFound)

	ctx := k8srequest.WithNamespace(t.Context(), "org-3")
	_, err := getPublicSnapshot(ctx, store, "missing", &metav1.GetOptions{})
	require.ErrorIs(t, err, notFound)
}
