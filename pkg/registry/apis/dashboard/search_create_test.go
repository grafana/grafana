package dashboard

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/selection"

	dashboardv0alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func createGrantPerms(scopes ...string) actest.FakeService {
	var perms []accesscontrol.Permission
	for _, s := range scopes {
		perms = append(perms, accesscontrol.Permission{Action: dashboards.ActionDashboardsCreate, Scope: s})
	}
	return actest.FakeService{ExpectedPermissions: perms}
}

// testFolders builds:
//
//	A ─┬─ B ── C
//	   └─ D
//	E
func testFolders() *foldertest.FakeService {
	svc := foldertest.NewFakeService()
	for uid, path := range map[string]string{"A": "A", "B": "A/B", "C": "A/B/C", "D": "A/D", "E": "E"} {
		svc.AddFolder(&folder.Folder{UID: uid, OrgID: 1, FullpathUIDs: path})
	}
	return svc
}

func TestResolveCreateGrants(t *testing.T) {
	user := &user.SignedInUser{OrgID: 1}

	t.Run("collects folder UIDs of dashboards:create only, sorted", func(t *testing.T) {
		svc := createGrantPerms("folders:uid:b", "folders:uid:a", "folders:uid:a")
		svc.ExpectedPermissions = append(svc.ExpectedPermissions, accesscontrol.Permission{Action: dashboards.ActionDashboardsWrite, Scope: "folders:uid:other"})

		grants, err := ResolveCreateGrants(context.Background(), svc, user)

		require.NoError(t, err)
		assert.False(t, grants.All)
		assert.Equal(t, []string{"a", "b"}, grants.UIDs)
	})

	t.Run("wildcard scope", func(t *testing.T) {
		grants, err := ResolveCreateGrants(context.Background(), createGrantPerms("folders:uid:a", "folders:*"), user)

		require.NoError(t, err)
		assert.True(t, grants.All)
		assert.Empty(t, grants.UIDs)
	})

	t.Run("returns the permission error", func(t *testing.T) {
		_, err := ResolveCreateGrants(context.Background(), actest.FakeService{ExpectedErr: errors.New("boom")}, user)

		require.Error(t, err)
	})
}

func TestCreatableTree(t *testing.T) {
	ctx := context.Background()
	tree, err := BuildCreatableTree(ctx, testFolders(), 1, CreateGrants{UIDs: []string{"C", "D", "gone"}})
	require.NoError(t, err)

	assert.Equal(t, []string{"A"}, tree.Children("general"), "root children, whichever root spelling is used")
	assert.Equal(t, []string{"A"}, tree.Children(""))
	assert.Equal(t, []string{"B", "D"}, tree.Children("A"))
	assert.Equal(t, []string{"C"}, tree.Children("B"))
	assert.Empty(t, tree.Children("E"))
	assert.True(t, tree.IsGrant("C"))
	assert.False(t, tree.IsGrant("A"))

	t.Run("inheritance", func(t *testing.T) {
		for name, tc := range map[string]struct {
			uid      string
			inherits bool
		}{
			"grant itself":        {"C", true},
			"descendant of C":     {"C", true},
			"ancestor of a grant": {"A", false},
			"unrelated":           {"E", false},
			"root":                {"general", false},
		} {
			t.Run(name, func(t *testing.T) {
				path, err := FolderPath(ctx, testFolders(), 1, tc.uid)
				require.NoError(t, err)
				assert.Equal(t, tc.inherits, tree.Inherited(path))
			})
		}
	})

	t.Run("a folder that is not found has no path", func(t *testing.T) {
		path, err := FolderPath(ctx, testFolders(), 1, "missing")
		require.NoError(t, err)
		assert.Empty(t, path)
	})

	t.Run("wildcard grants inherit everywhere", func(t *testing.T) {
		all, err := BuildCreatableTree(ctx, testFolders(), 1, CreateGrants{All: true})
		require.NoError(t, err)
		assert.True(t, all.Inherited([]string{"E"}))
	})

	t.Run("a root grant covers the root only", func(t *testing.T) {
		root, err := BuildCreatableTree(ctx, testFolders(), 1, CreateGrants{UIDs: []string{"general"}})
		require.NoError(t, err)
		assert.True(t, root.Inherited([]string{"general"}))
		assert.False(t, root.Inherited([]string{"A"}))
	})
}

type countingPerms struct {
	actest.FakeService
	calls int
}

func (c *countingPerms) GetUserPermissions(ctx context.Context, u identity.Requester, o accesscontrol.Options) ([]accesscontrol.Permission, error) {
	c.calls++
	return c.FakeService.GetUserPermissions(ctx, u, o)
}

func TestCreatableTreeCache(t *testing.T) {
	ctx := context.Background()
	u := &user.SignedInUser{OrgID: 1, UserUID: "u1"}

	t.Run("builds once per user", func(t *testing.T) {
		perms := &countingPerms{FakeService: createGrantPerms("folders:uid:C")}
		cache := NewCreatableTreeCache(perms, testFolders())

		first, err := cache.Get(ctx, u)
		require.NoError(t, err)
		second, err := cache.Get(ctx, u)
		require.NoError(t, err)
		_, err = cache.Get(ctx, &user.SignedInUser{OrgID: 1, UserUID: "u2"})
		require.NoError(t, err)

		assert.Same(t, first, second)
		assert.Equal(t, 2, perms.calls)
	})

	t.Run("does not cache errors", func(t *testing.T) {
		perms := &countingPerms{FakeService: actest.FakeService{ExpectedErr: errors.New("boom")}}
		cache := NewCreatableTreeCache(perms, testFolders())

		_, err := cache.Get(ctx, u)
		require.Error(t, err)
		_, err = cache.Get(ctx, u)
		require.Error(t, err)

		assert.Equal(t, 2, perms.calls)
	})
}

func setPickerToggles(t *testing.T, createPermission, creatableTree bool) {
	t.Helper()
	flag := func(key string, on bool) memprovider.InMemoryFlag {
		return memprovider.InMemoryFlag{Key: key, DefaultVariant: "v", Variants: map[string]any{"v": on}}
	}
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagFolderPickerCreatePermission:    flag(featuremgmt.FlagFolderPickerCreatePermission, createPermission),
		featuremgmt.FlagFolderPickerCreatableFolderTree: flag(featuremgmt.FlagFolderPickerCreatableFolderTree, creatableTree),
	})))
	t.Cleanup(func() { _ = openfeature.SetProviderAndWait(openfeature.NoopProvider{}) })
}

func folderRows(names ...string) *resourcepb.ResourceSearchResponse {
	rows := make([]*resourcepb.ResourceSearchRow, len(names))
	for i, n := range names {
		rows[i] = &resourcepb.ResourceSearchRow{Key: &resourcepb.ResourceKey{Name: n, Resource: "folders"}}
	}
	return &resourcepb.ResourceSearchResponse{ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES, Rows: rows, TotalHits: int64(len(rows))}
}

func nameFilter(req *resourcepb.ResourceSearchRequest) []string {
	for _, f := range req.Options.Fields {
		if f.Key == "name" && f.Operator == string(selection.In) {
			return f.Values
		}
	}
	return nil
}

func canCreateByName(res dashboardv0alpha1.SearchResults) map[string]*bool {
	out := map[string]*bool{}
	for _, h := range res.Hits {
		out[h.Name] = h.CanCreate
	}
	return out
}

func TestSearchHandlerCreatableFolderTree(t *testing.T) {
	grantsCD := createGrantPerms("folders:uid:C", "folders:uid:D")

	run := func(t *testing.T, perms accesscontrol.Service, parent string, responses ...*resourcepb.ResourceSearchResponse) (*MockClient, dashboardv0alpha1.SearchResults) {
		t.Helper()
		client := &MockClient{MockResponses: responses}
		handler := NewSearchHandler(tracing.NewNoopTracerService(), client, nil).WithCreatableTree(perms, testFolders())
		req := httptest.NewRequest("GET", "/search?type=folder&permission=create&folder="+parent, nil)
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test", OrgID: 1, UserUID: "u1"}))
		rr := httptest.NewRecorder()

		handler.DoSearch(rr, req)

		var res dashboardv0alpha1.SearchResults
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &res))
		return client, res
	}

	t.Run("inherited grant keeps the create search and flags every hit", func(t *testing.T) {
		setPickerToggles(t, true, true)

		client, res := run(t, grantsCD, "C", folderRows("X", "Y"))

		require.Equal(t, 1, client.CallCount)
		assert.Equal(t, int64(dashboardaccess.PERMISSION_CREATE), client.MockCalls[0].Permission)
		assert.Empty(t, nameFilter(client.MockCalls[0]))
		got := canCreateByName(res)
		require.Len(t, got, 2)
		for _, v := range got {
			require.NotNil(t, v)
			assert.True(t, *v)
		}
	})

	t.Run("no inherited grant narrows to folders on a path and flags only grants", func(t *testing.T) {
		setPickerToggles(t, true, true)

		client, res := run(t, grantsCD, "A", folderRows("B", "D"))

		require.Equal(t, 1, client.CallCount)
		assert.Equal(t, int64(0), client.MockCalls[0].Permission)
		assert.Equal(t, []string{"B", "D"}, nameFilter(client.MockCalls[0]))
		got := canCreateByName(res)
		require.NotNil(t, got["B"])
		assert.False(t, *got["B"])
		require.NotNil(t, got["D"])
		assert.True(t, *got["D"])
	})

	t.Run("adds create-only grants the read search could not return", func(t *testing.T) {
		setPickerToggles(t, true, true)

		client, res := run(t, grantsCD, "A", folderRows("B"), folderRows("D"))

		require.Equal(t, 2, client.CallCount)
		assert.Equal(t, int64(dashboardaccess.PERMISSION_CREATE), client.MockCalls[1].Permission)
		assert.Equal(t, []string{"D"}, nameFilter(client.MockCalls[1]))
		assert.Equal(t, int64(2), res.TotalHits)
		got := canCreateByName(res)
		require.NotNil(t, got["D"])
		assert.True(t, *got["D"])
	})

	t.Run("a folder with nothing creatable below it returns no hits without searching", func(t *testing.T) {
		setPickerToggles(t, true, true)

		client, res := run(t, grantsCD, "E")

		assert.Zero(t, client.CallCount)
		assert.Empty(t, res.Hits)
	})

	t.Run("the root lists the top of each path", func(t *testing.T) {
		setPickerToggles(t, true, true)

		client, _ := run(t, grantsCD, "general", folderRows("A"))

		assert.Equal(t, []string{"A"}, nameFilter(client.MockCalls[0]))
	})

	t.Run("falls back to the plain create search on error", func(t *testing.T) {
		setPickerToggles(t, true, true)

		client, res := run(t, actest.FakeService{ExpectedErr: errors.New("boom")}, "A", folderRows("B"))

		require.Equal(t, 1, client.CallCount)
		assert.Equal(t, int64(dashboardaccess.PERMISSION_CREATE), client.MockCalls[0].Permission)
		assert.Empty(t, nameFilter(client.MockCalls[0]))
		assert.Nil(t, canCreateByName(res)["B"])
	})

	for name, tc := range map[string]struct{ createPermission, creatableTree bool }{
		"creatable tree toggle off":    {true, false},
		"create permission toggle off": {false, true},
	} {
		t.Run(name+" leaves the request alone", func(t *testing.T) {
			setPickerToggles(t, tc.createPermission, tc.creatableTree)

			client, res := run(t, grantsCD, "A", folderRows("B"))

			require.Equal(t, 1, client.CallCount)
			assert.Empty(t, nameFilter(client.MockCalls[0]))
			assert.Nil(t, canCreateByName(res)["B"])
		})
	}

	t.Run("leaves shared-with-me and name-filtered searches alone", func(t *testing.T) {
		setPickerToggles(t, true, true)
		client := &MockClient{MockResponses: []*resourcepb.ResourceSearchResponse{folderRows("B")}}
		handler := NewSearchHandler(tracing.NewNoopTracerService(), client, nil).WithCreatableTree(grantsCD, testFolders())
		req := httptest.NewRequest("GET", "/search?type=folder&permission=create&folder=A&name=B", nil)
		req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{Namespace: "test", OrgID: 1}))

		handler.DoSearch(httptest.NewRecorder(), req)

		require.Equal(t, 1, client.CallCount)
		assert.Equal(t, []string{"B"}, nameFilter(client.MockCalls[0]))
	})
}
