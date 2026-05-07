package api

import (
	"context"
	"slices"
	"strings"
	"sync"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

// capturingZanzanaClient records every ListRequest it receives so tests can
// assert on the group / resource / verb / subject sent to Zanzana.
type capturingZanzanaClient struct {
	fakeZanzanaClient
	mu        sync.Mutex
	listCalls []*authzv1.ListRequest
}

func (c *capturingZanzanaClient) List(_ context.Context, req *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	c.mu.Lock()
	c.listCalls = append(c.listCalls, req)
	c.mu.Unlock()
	return c.listResp, c.listErr
}

// legacyPermissionMatches mirrors acimpl.PermissionMatchesSearchOptions (RAM / in-memory path)
// for parity tests. The api package cannot import acimpl due to a circular dependency.
func legacyPermissionMatches(p ac.Permission, opts *ac.SearchOptions) bool {
	if opts.Scope != "" {
		scopes := append(opts.Wildcards(), opts.Scope)
		if !slices.Contains(scopes, p.Scope) {
			return false
		}
	}
	if opts.Action != "" {
		return p.Action == opts.Action
	}
	return strings.HasPrefix(p.Action, opts.ActionPrefix)
}

// legacyFilter applies the same action + scope filtering legacy RBAC uses when searching permissions.
func legacyFilter(perms []ac.Permission, action, scope string) []ac.Permission {
	opts := &ac.SearchOptions{Action: action, Scope: scope}
	var out []ac.Permission
	for _, p := range perms {
		if legacyPermissionMatches(p, opts) {
			out = append(out, p)
		}
	}
	return out
}

// zanzanaResolve runs the Zanzana list → legacy permission mapping for one action.
func zanzanaResolve(resp *authzv1.ListResponse, action, scope string) ([]ac.Permission, error) {
	group, resource, verb := common.TranslateActionToListParams(action)
	if group == "" || resource == "" {
		return nil, nil
	}
	fake := &fakeZanzanaClient{listResp: resp}
	r := &zanzanaPermissionResolver{client: fake}
	return r.listPermissions(context.Background(), "org:1", "user:parity", group, resource, verb, action, scope)
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

// Scope filter edge cases not covered by TestLegacyZanzanaParity (dashboard-namespace filter
// with All=true; UID prefix must not false-positive).
func TestListPermissions_ScopeFilter_IncludesWildcardGrants(t *testing.T) {
	group, resource, verb := common.TranslateActionToListParams("dashboards:read")

	t.Run("All=true keeps dashboards wildcard when scope is dashboards namespace", func(t *testing.T) {
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

func TestListPermissions_ScopeFilter_WildcardScopeQuery(t *testing.T) {
	group, resource, verb := common.TranslateActionToListParams("dashboards:read")

	t.Run("wildcard query scope matches only wildcards, not individual items", func(t *testing.T) {
		fake := &fakeZanzanaClient{
			listResp: &authzv1.ListResponse{
				Items:   []string{"dash-1", "dash-2"},
				Folders: []string{"folder-1"},
			},
		}
		r := &zanzanaPermissionResolver{client: fake}

		// Filter by dashboards:uid:* — legacy semantics: match "dashboards:uid:*", "dashboards:*", "*"
		// but NOT individual dashboards:uid:<name>.
		perms, err := r.listPermissions(
			context.Background(),
			"org:1",
			"user:1",
			group,
			resource,
			verb,
			"dashboards:read",
			ac.Scope("dashboards", "uid", "*"),
		)
		require.NoError(t, err)
		require.Empty(t, perms, "individual items should not match a uid:* query scope")
	})

	t.Run("wildcard query scope matches All=true wildcard", func(t *testing.T) {
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
			ac.Scope("dashboards", "uid", "*"),
		)
		require.NoError(t, err)

		// dashboards:* encompasses dashboards:uid:*
		require.Equal(t, []ac.Permission{
			{Action: "dashboards:read", Scope: ac.Scope("dashboards", "*")},
		}, perms)
	})
}

// ---------------------------------------------------------------------------
// Subject type tests — verify Zanzana gets the right subject for users vs SAs
// ---------------------------------------------------------------------------

func TestSearchPermissionsForIdentity_ServiceAccount_SubjectType(t *testing.T) {
	fake := &capturingZanzanaClient{
		fakeZanzanaClient: fakeZanzanaClient{
			listResp: &authzv1.ListResponse{Items: []string{"dash-1"}},
		},
	}
	r := &zanzanaPermissionResolver{client: fake}

	_, err := r.searchPermissionsForIdentity(
		context.Background(),
		1,
		42,
		"sa-uid-123",
		true, // service account
		ac.SearchOptions{Action: "dashboards:read"},
	)
	require.NoError(t, err)

	require.NotEmpty(t, fake.listCalls)
	require.Equal(t, claims.NewTypeID(claims.TypeServiceAccount, "sa-uid-123"), fake.listCalls[0].Subject)
}

func TestSearchPermissionsForIdentity_User_SubjectType(t *testing.T) {
	fake := &capturingZanzanaClient{
		fakeZanzanaClient: fakeZanzanaClient{
			listResp: &authzv1.ListResponse{Items: []string{"dash-1"}},
		},
	}
	r := &zanzanaPermissionResolver{client: fake}

	_, err := r.searchPermissionsForIdentity(
		context.Background(),
		1,
		42,
		"user-uid-456",
		false, // regular user
		ac.SearchOptions{Action: "dashboards:read"},
	)
	require.NoError(t, err)

	require.NotEmpty(t, fake.listCalls)
	require.Equal(t, claims.NewTypeID(claims.TypeUser, "user-uid-456"), fake.listCalls[0].Subject)
}

// ---------------------------------------------------------------------------
// Unsupported action
// ---------------------------------------------------------------------------

func TestSearchPermissionsForIdentity_UnsupportedAction_ReturnsEmpty(t *testing.T) {
	fake := &capturingZanzanaClient{
		fakeZanzanaClient: fakeZanzanaClient{
			listResp: &authzv1.ListResponse{Items: []string{"something"}},
		},
	}
	r := &zanzanaPermissionResolver{client: fake}

	result, err := r.searchPermissionsForIdentity(
		context.Background(),
		1,
		42,
		"user-uid",
		false,
		ac.SearchOptions{Action: "users:read"},
	)
	require.NoError(t, err)

	// users:read is not in the Zanzana translation table, so no List call
	// should be made and the result should be empty.
	require.Empty(t, result)
	require.Empty(t, fake.listCalls, "should not call Zanzana List for untranslatable actions")
}

// ---------------------------------------------------------------------------
// ActionPrefix filtering
// ---------------------------------------------------------------------------

func TestSearchPermissionsForIdentity_ActionPrefix_FiltersToMatchingActions(t *testing.T) {
	fake := &capturingZanzanaClient{
		fakeZanzanaClient: fakeZanzanaClient{
			listResp: &authzv1.ListResponse{Items: []string{"uid-1"}},
		},
	}
	r := &zanzanaPermissionResolver{client: fake}

	result, err := r.searchPermissionsForIdentity(
		context.Background(),
		1,
		42,
		"user-uid",
		false,
		ac.SearchOptions{ActionPrefix: "folders:"},
	)
	require.NoError(t, err)

	perms := result[42]
	require.NotEmpty(t, perms)

	// Every returned permission must have a folders: action prefix.
	for _, p := range perms {
		require.Truef(t, len(p.Action) > 0 && p.Action[:8] == "folders:",
			"unexpected action %q for prefix folders:", p.Action)
	}

	// Verify no dashboards: actions leaked through.
	for _, p := range perms {
		require.NotContains(t, p.Action, "dashboards:",
			"dashboards: actions should not appear for folders: prefix")
	}
}

func TestSearchPermissionsForIdentity_ActionPrefix_WithScope(t *testing.T) {
	fake := &fakeZanzanaClient{
		listResp: &authzv1.ListResponse{
			Items: []string{"target-folder", "other-folder"},
		},
	}
	r := &zanzanaPermissionResolver{client: fake}

	result, err := r.searchPermissionsForIdentity(
		context.Background(),
		1,
		42,
		"user-uid",
		false,
		ac.SearchOptions{
			ActionPrefix: "folders:",
			Scope:        ac.Scope("folders", "uid", "target-folder"),
		},
	)
	require.NoError(t, err)

	perms := result[42]
	require.NotEmpty(t, perms)

	// Every permission must match the scope filter.
	for _, p := range perms {
		require.Equal(t, ac.Scope("folders", "uid", "target-folder"), p.Scope,
			"only the target folder scope should pass the filter, got %s for action %s", p.Scope, p.Action)
	}
}

// ---------------------------------------------------------------------------
// searchAllUsers guard
// ---------------------------------------------------------------------------

func TestSearchAllUsers_NoActionOrPrefix_ReturnsEmpty(t *testing.T) {
	fake := &fakeZanzanaClient{
		listResp: &authzv1.ListResponse{Items: []string{"uid-1"}},
	}
	r := &zanzanaPermissionResolver{client: fake}

	result, err := r.searchAllUsers(
		context.Background(),
		nil, // signedInUser not needed — early return
		1,
		ac.SearchOptions{}, // no action, no prefix
	)
	require.NoError(t, err)
	require.Empty(t, result, "searchAllUsers must return empty when no action/prefix filter is set")
}

// ---------------------------------------------------------------------------
// Namespace is derived from orgID
// ---------------------------------------------------------------------------

func TestSearchPermissionsForIdentity_NamespaceDerivedFromOrgID(t *testing.T) {
	fake := &capturingZanzanaClient{
		fakeZanzanaClient: fakeZanzanaClient{
			listResp: &authzv1.ListResponse{Items: []string{"dash-1"}},
		},
	}
	r := &zanzanaPermissionResolver{client: fake}

	_, err := r.searchPermissionsForIdentity(
		context.Background(),
		7, // orgID
		42,
		"user-uid",
		false,
		ac.SearchOptions{Action: "dashboards:read"},
	)
	require.NoError(t, err)

	require.NotEmpty(t, fake.listCalls)
	require.Equal(t, claims.OrgNamespaceFormatter(7), fake.listCalls[0].Namespace)
}

// ---------------------------------------------------------------------------
// Result is keyed by userID
// ---------------------------------------------------------------------------

func TestSearchPermissionsForIdentity_ResultKeyedByUserID(t *testing.T) {
	fake := &fakeZanzanaClient{
		listResp: &authzv1.ListResponse{Items: []string{"dash-1"}},
	}
	r := &zanzanaPermissionResolver{client: fake}

	result, err := r.searchPermissionsForIdentity(
		context.Background(),
		1,
		99, // userID
		"user-uid",
		false,
		ac.SearchOptions{Action: "dashboards:read"},
	)
	require.NoError(t, err)

	require.Contains(t, result, int64(99))
	require.NotContains(t, result, int64(0))
	require.NotContains(t, result, int64(1))
}

func TestSearchPermissionsForIdentity_EmptyResult_OmitsUserKey(t *testing.T) {
	fake := &fakeZanzanaClient{
		listResp: &authzv1.ListResponse{},
	}
	r := &zanzanaPermissionResolver{client: fake}

	result, err := r.searchPermissionsForIdentity(
		context.Background(),
		1,
		99,
		"user-uid",
		false,
		ac.SearchOptions{Action: "dashboards:read"},
	)
	require.NoError(t, err)
	require.Empty(t, result, "user should not appear in result map when they have no permissions")
}

// TestLegacyZanzanaParity compares legacy RBAC search filtering (in-memory, same rules as DB)
// with the Zanzana resolver output for equivalent authorization state. Rows with Skip set
// document known semantic or representation gaps.
func TestLegacyZanzanaParity(t *testing.T) {
	tests := []struct {
		name        string
		action      string
		scope       string
		legacyPerms []ac.Permission
		zanzanaResp *authzv1.ListResponse
		skip        string
	}{
		{
			name:   "items_only_no_scope_filter",
			action: "dashboards:read",
			legacyPerms: []ac.Permission{
				{Action: "dashboards:read", Scope: ac.Scope("dashboards", "uid", "d1")},
				{Action: "dashboards:read", Scope: ac.Scope("dashboards", "uid", "d2")},
			},
			zanzanaResp: &authzv1.ListResponse{Items: []string{"d1", "d2"}},
		},
		{
			name:   "items_and_folders_no_scope_filter",
			action: "dashboards:read",
			legacyPerms: []ac.Permission{
				{Action: "dashboards:read", Scope: ac.Scope("dashboards", "uid", "d1")},
				{Action: "dashboards:read", Scope: ac.Scope("folders", "uid", "f1")},
			},
			zanzanaResp: &authzv1.ListResponse{
				Items:   []string{"d1"},
				Folders: []string{"f1"},
			},
		},
		{
			name:   "items_two_dashboards_and_folder_no_scope_filter",
			action: "dashboards:read",
			legacyPerms: []ac.Permission{
				{Action: "dashboards:read", Scope: ac.Scope("dashboards", "uid", "d1")},
				{Action: "dashboards:read", Scope: ac.Scope("dashboards", "uid", "d2")},
				{Action: "dashboards:read", Scope: ac.Scope("folders", "uid", "f1")},
			},
			zanzanaResp: &authzv1.ListResponse{
				Items:   []string{"d1", "d2"},
				Folders: []string{"f1"},
			},
		},
		{
			name:   "all_true_dashboard_action_no_scope_filter",
			action: "dashboards:read",
			legacyPerms: []ac.Permission{
				{Action: "dashboards:read", Scope: "*"},
				{Action: "dashboards:read", Scope: ac.Scope("dashboards", "*")},
				{Action: "dashboards:read", Scope: ac.Scope("folders", "*")},
			},
			zanzanaResp: &authzv1.ListResponse{All: true},
		},
		{
			name:   "all_true_non_dashboard_action_no_scope_filter",
			action: "folders:read",
			legacyPerms: []ac.Permission{
				{Action: "folders:read", Scope: ac.Scope("folders", "*")},
			},
			zanzanaResp: &authzv1.ListResponse{All: true},
		},
		{
			name:   "scope_filter_keeps_only_matching_dashboard_uid",
			action: "dashboards:read",
			scope:  ac.Scope("dashboards", "uid", "match"),
			legacyPerms: []ac.Permission{
				{Action: "dashboards:read", Scope: ac.Scope("dashboards", "uid", "match")},
				{Action: "dashboards:read", Scope: ac.Scope("dashboards", "uid", "other")},
				{Action: "dashboards:read", Scope: ac.Scope("folders", "uid", "f1")},
			},
			zanzanaResp: &authzv1.ListResponse{
				Items:   []string{"match", "other"},
				Folders: []string{"f1"},
			},
		},
		{
			name:   "scope_filter_on_folder_uid_keeps_folder_wildcard_from_all",
			action: "dashboards:read",
			scope:  ac.Scope("folders", "uid", "some-folder"),
			legacyPerms: []ac.Permission{
				{Action: "dashboards:read", Scope: ac.Scope("dashboards", "*")},
				{Action: "dashboards:read", Scope: ac.Scope("folders", "*")},
			},
			zanzanaResp: &authzv1.ListResponse{All: true},
		},
		{
			name:        "empty_list_response",
			action:      "dashboards:read",
			legacyPerms: nil,
			zanzanaResp: &authzv1.ListResponse{},
		},
		{
			name:   "legacy_global_star_aligned_with_zanzana_all",
			action: "dashboards:read",
			legacyPerms: []ac.Permission{
				{Action: "dashboards:read", Scope: "*"},
				{Action: "dashboards:read", Scope: ac.Scope("dashboards", "*")},
				{Action: "dashboards:read", Scope: ac.Scope("folders", "*")},
			},
			zanzanaResp: &authzv1.ListResponse{All: true},
		},
		{
			name:   "legacy_intermediate_dashboards_uid_star",
			action: "dashboards:read",
			legacyPerms: []ac.Permission{
				{Action: "dashboards:read", Scope: ac.Scope("dashboards", "uid", "*")},
			},
			zanzanaResp: &authzv1.ListResponse{Items: []string{"any"}},
			skip:        "legacy stores dashboards:uid:*; Zanzana emits dashboards:uid:<name> per item, not the intermediate wildcard string",
		},
		{
			name:   "legacy_redundant_wildcard_and_specific_items",
			action: "dashboards:read",
			legacyPerms: []ac.Permission{
				{Action: "dashboards:read", Scope: "*"},
				{Action: "dashboards:read", Scope: ac.Scope("dashboards", "*")},
				{Action: "dashboards:read", Scope: ac.Scope("folders", "*")},
				{Action: "dashboards:read", Scope: ac.Scope("dashboards", "uid", "d1")},
			},
			zanzanaResp: &authzv1.ListResponse{All: true, Items: []string{"d1"}},
		},
		{
			name:   "legacy_action_set_name_not_translated",
			action: "dashboards:read",
			legacyPerms: []ac.Permission{
				{Action: "dashboards:view", Scope: ac.Scope("dashboards", "*")},
			},
			zanzanaResp: &authzv1.ListResponse{All: true},
			skip:        "parity row uses action dashboards:read for Zanzana; action sets (dashboards:view) are expanded in legacy acimpl, not in the Zanzana resolver",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.skip != "" {
				t.Skip(tt.skip)
			}

			legacy := legacyFilter(tt.legacyPerms, tt.action, tt.scope)
			zanzana, err := zanzanaResolve(tt.zanzanaResp, tt.action, tt.scope)
			require.NoError(t, err)

			if legacy == nil {
				legacy = []ac.Permission{}
			}
			if zanzana == nil {
				zanzana = []ac.Permission{}
			}
			sortPermissions(legacy)
			sortPermissions(zanzana)
			require.Equal(t, legacy, zanzana)
		})
	}
}
