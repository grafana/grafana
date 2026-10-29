package snapshot

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestSnapshotListRefillsOwnedPages(t *testing.T) {
	page := func(next string, creators ...string) *dashv0.SnapshotList {
		list := &dashv0.SnapshotList{ListMeta: metav1.ListMeta{Continue: next, ResourceVersion: "123", RemainingItemCount: new(int64(10))}}
		for _, creator := range creators {
			snap := dashv0.Snapshot{Spec: dashv0.SnapshotSpec{DeleteKey: new("secret"), Dashboard: map[string]any{"title": "private"}}}
			snap.SetCreatedBy("user:" + creator)
			list.Items = append(list.Items, snap)
		}
		return list
	}
	for _, tc := range []struct {
		name         string
		pages        []*dashv0.SnapshotList
		limits       []int64
		want         int
		wantContinue string
		lastErr      error
		admin        bool
		unlimited    bool
	}{
		{name: "skip hidden first page and fill", pages: []*dashv0.SnapshotList{page("page2", "bob", "bob"), page("page3", "alice", "bob"), page("page4", "alice")}, limits: []int64{2, 2, 1}, want: 2, wantContinue: "page4"},
		{name: "stop at exhaustion", pages: []*dashv0.SnapshotList{page("page2", "bob", "alice"), page("", "bob")}, limits: []int64{2, 1}, want: 1},
		{name: "all hidden", pages: []*dashv0.SnapshotList{page("page2", "bob", "bob"), page("", "bob")}, limits: []int64{2, 2}, want: 0},
		{name: "admin does not refill", pages: []*dashv0.SnapshotList{page("page2", "bob", "bob")}, limits: []int64{2}, want: 2, wantContinue: "page2", admin: true},
		{name: "unlimited does not refill", pages: []*dashv0.SnapshotList{page("page2", "bob", "alice")}, limits: []int64{0}, want: 1, wantContinue: "page2", unlimited: true},
		{name: "already full", pages: []*dashv0.SnapshotList{page("page2", "alice", "alice")}, limits: []int64{2}, want: 2, wantContinue: "page2"},
		{name: "empty underlying page", pages: []*dashv0.SnapshotList{page("page2"), page("", "alice")}, limits: []int64{2, 2}, want: 1},
		{name: "later error fails closed", pages: []*dashv0.SnapshotList{page("page2", "alice", "bob"), nil}, limits: []int64{2, 1}, lastErr: errors.New("storage unavailable")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			storage := grafanarest.NewMockStorage(t)
			options := &internalversion.ListOptions{Limit: 2, Continue: "start"}
			if tc.unlimited {
				options.Limit = 0
			}
			calls := 0
			storage.On("List", mock.Anything, mock.Anything).Return(func(_ context.Context, opts *internalversion.ListOptions) (runtime.Object, error) {
				i := calls
				calls++
				require.Less(t, i, len(tc.pages))
				require.Equal(t, tc.limits[i], opts.Limit)
				next := "start"
				if i > 0 {
					next = tc.pages[i-1].Continue
				}
				require.Equal(t, next, opts.Continue)
				if i == len(tc.pages)-1 && tc.lastErr != nil {
					return nil, tc.lastErr
				}
				return tc.pages[i], nil
			})
			wrapper := NewStorageWrapper(storage, dashv0.SnapshotSharingOptions{}, acmock.New(), nil).(rest.Lister)
			role := org.RoleEditor
			if tc.admin {
				role = org.RoleAdmin
			}
			ctx := identity.WithRequester(ctxForOrg(1), &user.SignedInUser{OrgID: 1, UserID: 1, UserUID: "alice", OrgRole: role})
			obj, err := wrapper.List(ctx, options)
			require.Equal(t, len(tc.pages), calls)
			require.Equal(t, tc.limits[0], options.Limit)
			require.Equal(t, "start", options.Continue)
			if tc.lastErr != nil {
				require.ErrorIs(t, err, tc.lastErr)
				require.Nil(t, obj)
				return
			}
			require.NoError(t, err)
			got := obj.(*dashv0.SnapshotList)
			require.Len(t, got.Items, tc.want)
			require.Equal(t, tc.wantContinue, got.Continue)
			require.Equal(t, "123", got.ResourceVersion)
			if tc.admin {
				require.NotNil(t, got.RemainingItemCount)
			} else {
				require.Nil(t, got.RemainingItemCount)
			}
			for _, snap := range got.Items {
				require.Nil(t, snap.Spec.DeleteKey)
				require.Nil(t, snap.Spec.Dashboard)
			}
			for _, original := range tc.pages {
				if original != nil {
					for _, snap := range original.Items {
						require.NotNil(t, snap.Spec.DeleteKey)
					}
				}
			}
		})
	}
}
