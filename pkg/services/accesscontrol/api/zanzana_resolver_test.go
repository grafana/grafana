package api

import (
	"context"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func TestListPermissions_MapsZanzanaFoldersToLegacyFolderScopes(t *testing.T) {
	group, resource, verb := common.TranslateActionToListParams("dashboards:read")
	require.NotEmpty(t, group)
	require.NotEmpty(t, verb)

	fake := &fakeZanzanaClient{
		listResp: &authzv1.ListResponse{
			Items:   []string{"some-dashboard-uid"},
			Folders: []string{"d70a877a-cf3c-4b71-9d36-9f247dc9a725", "f054cb8b-2208-4c6e-a965-c02b8dcaba0e"},
		},
	}
	r := &zanzanaPermissionResolver{client: fake}

	perms, err := r.listPermissions(
		context.Background(),
		"org:1",
		"user:someuid",
		group,
		resource,
		verb,
		"dashboards:read",
		"",
	)
	require.NoError(t, err)

	want := []ac.Permission{
		{Action: "dashboards:read", Scope: ac.Scope("dashboards", "uid", "some-dashboard-uid")},
		{Action: "dashboards:read", Scope: ac.Scope("folders", "uid", "d70a877a-cf3c-4b71-9d36-9f247dc9a725")},
		{Action: "dashboards:read", Scope: ac.Scope("folders", "uid", "f054cb8b-2208-4c6e-a965-c02b8dcaba0e")},
	}
	require.ElementsMatch(t, want, perms)
}

func TestListPermissions_AllTrue_IncludesDashboardAndFolderWildcardsForDashboardActions(t *testing.T) {
	group, resource, verb := common.TranslateActionToListParams("dashboards:read")
	fake := &fakeZanzanaClient{listResp: &authzv1.ListResponse{All: true}}
	r := &zanzanaPermissionResolver{client: fake}

	perms, err := r.listPermissions(
		context.Background(),
		"org:1",
		"user:1",
		group,
		resource,
		verb,
		"dashboards:read",
		"",
	)
	require.NoError(t, err)

	require.ElementsMatch(t, []ac.Permission{
		{Action: "dashboards:read", Scope: ac.Scope("dashboards", "*")},
		{Action: "dashboards:read", Scope: ac.Scope("folders", "*")},
	}, perms)
}

func TestSearchPermissionsForIdentity_NoActionOrPrefix_ListsAllSupportedActions(t *testing.T) {
	fake := &fakeZanzanaClient{
		listResp: &authzv1.ListResponse{
			Items: []string{"uid-1"},
		},
	}
	r := &zanzanaPermissionResolver{client: fake}

	result, err := r.searchPermissionsForIdentity(
		context.Background(),
		1,
		42,
		"user-uid",
		false,
		ac.SearchOptions{},
	)
	require.NoError(t, err)

	perms := result[42]
	require.NotEmpty(t, perms, "should return permissions when neither action nor actionPrefix is set")

	supported := common.SupportedActions()
	require.True(t, len(perms) >= len(supported),
		"should have at least one permission per supported action (got %d perms for %d actions)", len(perms), len(supported))

	actions := map[string]bool{}
	for _, p := range perms {
		actions[p.Action] = true
	}
	for _, entry := range supported {
		require.True(t, actions[entry.Action], "expected action %s to be present in results", entry.Action)
	}
}

func TestSearchPermissionsForIdentity_WithAction_DoesNotListAll(t *testing.T) {
	fake := &fakeZanzanaClient{
		listResp: &authzv1.ListResponse{
			Items: []string{"dash-1"},
		},
	}
	r := &zanzanaPermissionResolver{client: fake}

	result, err := r.searchPermissionsForIdentity(
		context.Background(),
		1,
		42,
		"user-uid",
		false,
		ac.SearchOptions{Action: "dashboards:read"},
	)
	require.NoError(t, err)

	perms := result[42]
	require.Len(t, perms, 1)
	require.Equal(t, "dashboards:read", perms[0].Action)
}

func TestListPermissions_ScopeFilter_AppliesToFolderScopes(t *testing.T) {
	group, resource, verb := common.TranslateActionToListParams("dashboards:read")
	fake := &fakeZanzanaClient{
		listResp: &authzv1.ListResponse{
			Folders: []string{"keep-me", "drop-me"},
		},
	}
	r := &zanzanaPermissionResolver{client: fake}

	perms, err := r.listPermissions(
		context.Background(),
		"org:1",
		"user:1",
		group,
		resource,
		verb,
		"dashboards:read",
		ac.Scope("folders", "uid", "keep-me"),
	)
	require.NoError(t, err)

	require.Equal(t, []ac.Permission{
		{Action: "dashboards:read", Scope: ac.Scope("folders", "uid", "keep-me")},
	}, perms)
}

func TestListPermissions_ScopeFilter_IncludesWildcardGrants(t *testing.T) {
	group, resource, verb := common.TranslateActionToListParams("dashboards:read")

	t.Run("All=true keeps wildcards that encompass the filter scope", func(t *testing.T) {
		fake := &fakeZanzanaClient{
			listResp: &authzv1.ListResponse{All: true},
		}
		r := &zanzanaPermissionResolver{client: fake}

		perms, err := r.listPermissions(
			context.Background(),
			"org:1",
			"user:1",
			group,
			resource,
			verb,
			"dashboards:read",
			ac.Scope("folders", "uid", "some-folder"),
		)
		require.NoError(t, err)

		// folders:* is a wildcard that encompasses folders:uid:some-folder.
		// dashboards:* belongs to a different namespace and is correctly excluded.
		require.Equal(t, []ac.Permission{
			{Action: "dashboards:read", Scope: ac.Scope("folders", "*")},
		}, perms)
	})

	t.Run("All=true keeps both wildcards when scope is in dashboards namespace", func(t *testing.T) {
		fake := &fakeZanzanaClient{
			listResp: &authzv1.ListResponse{All: true},
		}
		r := &zanzanaPermissionResolver{client: fake}

		perms, err := r.listPermissions(
			context.Background(),
			"org:1",
			"user:1",
			group,
			resource,
			verb,
			"dashboards:read",
			ac.Scope("dashboards", "uid", "some-dash"),
		)
		require.NoError(t, err)

		// dashboards:* encompasses dashboards:uid:some-dash; folders:* does not.
		require.Equal(t, []ac.Permission{
			{Action: "dashboards:read", Scope: ac.Scope("dashboards", "*")},
		}, perms)
	})

	t.Run("non-matching items are excluded while wildcards are kept", func(t *testing.T) {
		fake := &fakeZanzanaClient{
			listResp: &authzv1.ListResponse{
				Items:   []string{"match-uid", "other-uid"},
				Folders: []string{"target-folder", "other-folder"},
			},
		}
		r := &zanzanaPermissionResolver{client: fake}

		perms, err := r.listPermissions(
			context.Background(),
			"org:1",
			"user:1",
			group,
			resource,
			verb,
			"dashboards:read",
			ac.Scope("dashboards", "uid", "match-uid"),
		)
		require.NoError(t, err)

		require.Equal(t, []ac.Permission{
			{Action: "dashboards:read", Scope: ac.Scope("dashboards", "uid", "match-uid")},
		}, perms)
	})

	t.Run("prefix-similar scopes are not false-positives", func(t *testing.T) {
		fake := &fakeZanzanaClient{
			listResp: &authzv1.ListResponse{
				Items: []string{"abc", "abcdef"},
			},
		}
		r := &zanzanaPermissionResolver{client: fake}

		perms, err := r.listPermissions(
			context.Background(),
			"org:1",
			"user:1",
			group,
			resource,
			verb,
			"dashboards:read",
			ac.Scope("dashboards", "uid", "abc"),
		)
		require.NoError(t, err)

		require.Equal(t, []ac.Permission{
			{Action: "dashboards:read", Scope: ac.Scope("dashboards", "uid", "abc")},
		}, perms, "abcdef must not match a filter for abc")
	})
}
