package resources

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type lookupAccessClient struct {
	authlib.AccessClient
	check func(context.Context, authlib.AuthInfo, authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error)
}

func (c lookupAccessClient) BatchCheck(ctx context.Context, caller authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return c.check(ctx, caller, req)
}

func newLookupTest(t *testing.T) (*resourcePathLookup, *MockResourceLister, context.Context) {
	t.Helper()
	lister := NewMockResourceLister(t)
	caller := &identity.StaticRequester{Namespace: "default", UserUID: "reader", OrgRole: identity.RoleViewer}
	ctx := authlib.WithAuthInfo(t.Context(), caller)
	return &resourcePathLookup{lister: lister, access: authlib.FixedAccessClient(true)}, lister, ctx
}

func lookupItem(gvr schema.GroupVersionResource, name, path string) provisioning.ResourceListItem {
	return provisioning.ResourceListItem{
		Group: gvr.Group, Resource: gvr.Resource, Name: name, Path: path,
		Folder: "parent", Hash: "checksum", Title: "Title", Time: 123,
	}
}

func TestResourcePathLookup_FiltersBeforeAuthorization(t *testing.T) {
	lookup, lister, ctx := newLookupTest(t)
	lister.EXPECT().List(ctx, "default", "test-repo").Return(&provisioning.ResourceList{Items: []provisioning.ResourceListItem{
		lookupItem(DashboardResource, "unrequested", "other.json"),
		lookupItem(DashboardResource, "cpu", "cpu.json"),
		lookupItem(DashboardResource, "denied", "denied.json"),
		lookupItem(DashboardResource, "cpu", "cpu.json"),
	}}, nil).Once()
	var checks []authlib.BatchCheckRequest
	lookup.access = lookupAccessClient{check: func(got context.Context, caller authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
		require.Same(t, ctx, got)
		original, _ := authlib.AuthInfoFrom(ctx)
		require.Same(t, original, caller)
		checks = append(checks, req)
		return authlib.BatchCheckResponse{Results: map[string]authlib.BatchCheckResult{"0": {Allowed: true}, "1": {Allowed: false}}}, nil
	}}

	got, err := lookup.Lookup(ctx, "default", "test-repo", []string{"cpu.json", "denied.json", "cpu.json"})
	require.NoError(t, err)
	require.Equal(t, []provisioning.ResourceListItem{{Path: "cpu.json", Group: DashboardResource.Group, Resource: "dashboards", Name: "cpu"}}, got.Items)
	require.Equal(t, []authlib.BatchCheckRequest{{Namespace: "default", Checks: []authlib.BatchCheckItem{
		{CorrelationID: "0", Verb: "get", Group: DashboardResource.Group, Resource: "dashboards", Name: "cpu", Folder: "parent"},
		{CorrelationID: "1", Verb: "get", Group: DashboardResource.Group, Resource: "dashboards", Name: "denied", Folder: "parent"},
	}}}, checks)
}

func TestResourcePathLookup_FolderPaths(t *testing.T) {
	lookup, lister, ctx := newLookupTest(t)
	list := &provisioning.ResourceList{Items: []provisioning.ResourceListItem{
		lookupItem(FolderResource, "team", "team"),
		lookupItem(FolderResource, "team", "team/"),
		lookupItem(FolderResource, "other", "other/"),
		lookupItem(FolderResource, "test-repo", ""),
		lookupItem(FolderResource, "not-root", ""),
		lookupItem(FolderResource, "child", "team/child"),
		lookupItem(DashboardResource, "cpu", "team/cpu.json"),
		lookupItem(DashboardResource, "not-a-folder", "team/"),
	}}
	lister.EXPECT().List(ctx, "default", "test-repo").Return(list, nil).Once()

	got, err := lookup.Lookup(ctx, "default", "test-repo", []string{"team/", "other/", "/"})
	require.NoError(t, err)
	require.Equal(t, []provisioning.ResourceListItem{
		{Path: "team/", Group: FolderResource.Group, Resource: "folders", Name: "team"},
		{Path: "other/", Group: FolderResource.Group, Resource: "folders", Name: "other"},
		{Path: "/", Group: FolderResource.Group, Resource: "folders", Name: "test-repo"},
	}, got.Items)
	require.Equal(t, "team", list.Items[0].Path)
	require.Equal(t, "", list.Items[3].Path)
}

func TestResourcePathLookup_NoMatches(t *testing.T) {
	for _, items := range [][]provisioning.ResourceListItem{nil, {lookupItem(DashboardResource, "other", "other.json")}} {
		lookup, lister, ctx := newLookupTest(t)
		lister.EXPECT().List(ctx, "default", "test-repo").Return(&provisioning.ResourceList{Items: items}, nil).Once()
		lookup.access = lookupAccessClient{check: func(context.Context, authlib.AuthInfo, authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
			t.Fatal("unmatched resources must not be authorized")
			return authlib.BatchCheckResponse{}, nil
		}}
		got, err := lookup.Lookup(ctx, "default", "test-repo", []string{"missing.json"})
		require.NoError(t, err)
		require.Equal(t, &provisioning.ResourceList{Items: []provisioning.ResourceListItem{}}, got)
	}
}

func TestResourcePathLookup_UsesManagedObjectListing(t *testing.T) {
	store := resource.NewMockResourceClient(t)
	ctx := authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{Namespace: "default", OrgRole: identity.RoleViewer})
	store.EXPECT().ListManagedObjects(ctx, mock.MatchedBy(func(req *resourcepb.ListManagedObjectsRequest) bool {
		return req.Namespace == "default" && req.Kind == "repo" && req.Id == "test-repo" && req.NextPageToken == ""
	})).Return(&resourcepb.ListManagedObjectsResponse{Items: []*resourcepb.ListManagedObjectsResponse_Item{
		{Object: &resourcepb.ResourceKey{Group: DashboardResource.Group, Resource: "dashboards", Name: "cpu"}, Path: "cpu.json", Folder: "parent", Title: "CPU", Hash: "checksum", Time: 123},
	}}, nil).Once()

	lookup := NewResourcePathLookup(NewResourceLister(store), authlib.FixedAccessClient(true))
	got, err := lookup.Lookup(ctx, "default", "test-repo", []string{"cpu.json"})
	require.NoError(t, err)
	require.Equal(t, []provisioning.ResourceListItem{{Path: "cpu.json", Group: DashboardResource.Group, Resource: "dashboards", Name: "cpu"}}, got.Items)
}

func TestResourcePathLookup_ListErrors(t *testing.T) {
	for _, tc := range resourceErrorCases(t) {
		t.Run(tc.name, func(t *testing.T) {
			store := resource.NewMockResourceClient(t)
			ctx := authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{Namespace: "default", OrgRole: identity.RoleViewer})
			store.EXPECT().ListManagedObjects(ctx, mock.Anything).Return(&resourcepb.ListManagedObjectsResponse{Error: tc.result}, tc.err).Once()
			lookup := NewResourcePathLookup(NewResourceLister(store), lookupAccessClient{check: func(context.Context, authlib.AuthInfo, authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
				t.Fatal("a failed listing must not reach authorization")
				return authlib.BatchCheckResponse{}, nil
			}})
			got, err := lookup.Lookup(ctx, "default", "test-repo", []string{"cpu.json"})
			require.Nil(t, got)
			tc.assertError(t, err)
		})
	}
}

func TestResourcePathLookup_AuthorizationErrors(t *testing.T) {
	for _, tc := range []struct {
		name     string
		response authlib.BatchCheckResponse
		err      error
	}{
		{name: "transport", err: errors.New("authorization unavailable")},
		{name: "missing result", response: authlib.BatchCheckResponse{Results: map[string]authlib.BatchCheckResult{}}},
		{name: "item error", response: authlib.BatchCheckResponse{Results: map[string]authlib.BatchCheckResult{"0": {Allowed: true, Error: errors.New("authorization failed")}}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			lookup, lister, ctx := newLookupTest(t)
			lister.EXPECT().List(ctx, "default", "test-repo").Return(&provisioning.ResourceList{Items: []provisioning.ResourceListItem{lookupItem(DashboardResource, "cpu", "cpu.json")}}, nil).Once()
			lookup.access = lookupAccessClient{check: func(context.Context, authlib.AuthInfo, authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
				return tc.response, tc.err
			}}
			got, err := lookup.Lookup(ctx, "default", "test-repo", []string{"cpu.json"})
			require.Error(t, err)
			require.Nil(t, got)
		})
	}
}

func TestResourcePathLookup_AuthorizationBatches(t *testing.T) {
	for _, failLast := range []bool{false, true} {
		t.Run(fmt.Sprintf("later batch fails=%t", failLast), func(t *testing.T) {
			lookup, lister, ctx := newLookupTest(t)
			items := make([]provisioning.ResourceListItem, 0, 51)
			for i := range 51 {
				items = append(items, lookupItem(DashboardResource, fmt.Sprintf("dashboard-%d", i), "cpu.json"))
			}
			lister.EXPECT().List(ctx, "default", "test-repo").Return(&provisioning.ResourceList{Items: items}, nil).Once()
			var sizes []int
			lookup.access = lookupAccessClient{check: func(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
				sizes = append(sizes, len(req.Checks))
				if failLast && len(sizes) == 2 {
					return authlib.BatchCheckResponse{}, errors.New("authorization unavailable")
				}
				rsp := authlib.BatchCheckResponse{Results: map[string]authlib.BatchCheckResult{}}
				for _, check := range req.Checks {
					rsp.Results[check.CorrelationID] = authlib.BatchCheckResult{Allowed: check.Name == "dashboard-0" || check.Name == "dashboard-50"}
				}
				return rsp, nil
			}}
			got, err := lookup.Lookup(ctx, "default", "test-repo", []string{"cpu.json"})
			require.Equal(t, []int{50, 1}, sizes)
			if failLast {
				require.ErrorContains(t, err, "authorization unavailable")
				require.Nil(t, got)
				return
			}
			require.NoError(t, err)
			require.Equal(t, []provisioning.ResourceListItem{
				{Path: "cpu.json", Group: DashboardResource.Group, Resource: "dashboards", Name: "dashboard-0"},
				{Path: "cpu.json", Group: DashboardResource.Group, Resource: "dashboards", Name: "dashboard-50"},
			}, got.Items)
		})
	}
}

func TestResourcePathLookup_Bounds(t *testing.T) {
	ctx := authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{Namespace: "default", OrgRole: identity.RoleViewer})
	for _, paths := range [][]string{nil, {}, {""}, {"../cpu.json"}, {"a/../cpu.json"}, {"/cpu.json"}, {"a//cpu.json"}, {"a%2Fcpu.json"}, {strings.Repeat("x", 1025)}, make([]string, MaxResourceLookupPaths+1)} {
		t.Run(fmt.Sprint(paths), func(t *testing.T) {
			got, err := (&resourcePathLookup{}).Lookup(ctx, "default", "repo", paths)
			require.True(t, apierrors.IsBadRequest(err), "%v", err)
			require.Nil(t, got)
		})
	}
	_, err := (&resourcePathLookup{}).Lookup(t.Context(), "default", "repo", []string{"cpu.json"})
	require.True(t, apierrors.IsUnauthorized(err))
	_, err = (&resourcePathLookup{}).Lookup(ctx, "another", "repo", []string{"cpu.json"})
	require.True(t, apierrors.IsForbidden(err))
}
