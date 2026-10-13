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

func TestPublicSnapshotLookupPreservesSuccessfulGet(t *testing.T) {
	for _, tc := range []struct {
		name     string
		listHit  bool
		otherOrg bool
		listErr  error
	}{
		{name: "list omits resolved snapshot"},
		{name: "list repeats resolved snapshot", listHit: true},
		{name: "list only returns another namespace", listHit: true, otherOrg: true},
		{name: "list error fails closed", listErr: apierrors.NewServiceUnavailable("storage unavailable")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			resolved := newBlobTestSnapshot()
			resolved.Namespace = "default"
			list := &dashv0.SnapshotList{}
			if tc.listHit {
				listed := resolved.DeepCopy()
				listed.Spec.Dashboard = map[string]any{"title": "listed version"}
				if tc.otherOrg {
					listed.Namespace = "org-2"
				}
				list.Items = []dashv0.Snapshot{*listed}
			}
			store := grafanarest.NewMockStorage(t)
			store.On("Get", mock.Anything, resolved.Name, mock.Anything).Return(resolved, nil).Once()
			store.On("List", mock.Anything, mock.Anything).Return(list, tc.listErr).Once()
			ctx := k8srequest.WithNamespace(t.Context(), "default")
			obj, err := getPublicSnapshot(ctx, store, resolved.Name, &metav1.GetOptions{})
			switch {
			case tc.listErr != nil:
				require.ErrorIs(t, err, tc.listErr)
				require.Nil(t, obj)
			case tc.otherOrg:
				require.True(t, apierrors.IsConflict(err))
				require.Nil(t, obj)
			default:
				require.NoError(t, err)
				require.Equal(t, resolved, obj)
			}
		})
	}
}

func TestPublicSnapshotLookupRejectsAmbiguousKeys(t *testing.T) {
	for _, defaultMatch := range []bool{false, true} {
		t.Run(map[bool]string{false: "matches on separate pages", true: "default namespace match"}[defaultMatch], func(t *testing.T) {
			first := newBlobTestSnapshot()
			first.Namespace = "org-2"
			second := first.DeepCopy()
			second.Namespace = "org-3"
			store := grafanarest.NewMockStorage(t)
			if defaultMatch {
				first.Namespace = "default"
				store.On("Get", mock.Anything, first.Name, mock.Anything).Return(first, nil)
				store.On("List", mock.Anything, mock.Anything).Return(&dashv0.SnapshotList{Items: []dashv0.Snapshot{*first, *second}}, nil).Once()
			} else {
				store.On("Get", mock.Anything, first.Name, mock.Anything).Return(nil, apierrors.NewNotFound(dashv0.SnapshotResourceInfo.GroupResource(), first.Name))
				store.On("List", mock.Anything, mock.MatchedBy(func(opts *internalversion.ListOptions) bool {
					return opts.Continue == ""
				})).Return(&dashv0.SnapshotList{ListMeta: metav1.ListMeta{Continue: "next-page"}, Items: []dashv0.Snapshot{*first}}, nil).Once()
				store.On("List", mock.Anything, mock.MatchedBy(func(opts *internalversion.ListOptions) bool {
					return opts.Continue == "next-page"
				})).Return(&dashv0.SnapshotList{Items: []dashv0.Snapshot{*second}}, nil).Once()
			}
			ctx := k8srequest.WithNamespace(t.Context(), "default")
			obj, err := getPublicSnapshot(ctx, store, first.Name, &metav1.GetOptions{})
			require.True(t, apierrors.IsConflict(err), "expected ambiguous key to be rejected, got object %v and error %v", obj, err)
			require.Nil(t, obj)
		})
	}
}

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
