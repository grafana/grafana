package acimpl

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Seed independently assigned roles with the same permission to retain observable
// multiplicity across sources, rather than reducing the result to an action map.
func seedContractSources(t *testing.T, sql db.DB) {
	t.Helper()
	require.NoError(t, sql.WithDbSession(context.Background(), func(sess *db.Session) error {
		for i, source := range []string{"direct", "team", "basic", "other-team", "other-org"} {
			now := time.Now()
			role := accesscontrol.Role{Name: "managed:" + source, UID: source, OrgID: 1, Created: now, Updated: now}
			if source == "other-org" {
				role.OrgID = 2
			}
			if _, err := sess.Insert(&role); err != nil {
				return err
			}
			scope := "dashboards:uid:shared"
			if i > 2 {
				scope = "dashboards:uid:excluded"
			}
			if _, err := sess.Insert(&accesscontrol.Permission{RoleID: role.ID, Action: "dashboards:read", Scope: scope, Created: now, Updated: now}); err != nil {
				return err
			}
			var assignment any
			switch source {
			case "direct":
				assignment = &accesscontrol.UserRole{RoleID: role.ID, OrgID: 1, UserID: 7, Created: now}
			case "team":
				assignment = &accesscontrol.TeamRole{RoleID: role.ID, OrgID: 1, TeamID: 10, Created: now}
			case "basic":
				assignment = &accesscontrol.BuiltinRole{RoleID: role.ID, OrgID: 1, Role: "Viewer", Created: now, Updated: now}
			case "other-team":
				assignment = &accesscontrol.TeamRole{RoleID: role.ID, OrgID: 1, TeamID: 11, Created: now}
			case "other-org":
				assignment = &accesscontrol.TeamRole{RoleID: role.ID, OrgID: 2, TeamID: 10, Created: now}
			}
			if _, err := sess.Insert(assignment); err != nil {
				return err
			}
		}
		return nil
	}))
}

func TestIntegrationGetUserPermissions_ContractRequesterSources(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, cache := range []bool{false, true} {
		t.Run(fmt.Sprintf("cache=%t", cache), func(t *testing.T) {
			s := setupTestEnv(t, false)
			s.cfg.RBAC.PermissionCache = cache
			seedContractSources(t, s.sql)
			baseline := accesscontrol.Permission{Action: "folders:read", Scope: "folders:uid:sharedwithme"}
			grant := accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:shared"}
			for _, tc := range []struct {
				name      string
				requester user.SignedInUser
				want      []accesscontrol.Permission
			}{
				{"combined", user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleViewer, TeamIDs: []int64{10}}, []accesscontrol.Permission{baseline, grant, grant, grant}}, //nolint:staticcheck // Numeric RBAC team grants are distinct from contextual groups.
				{"direct", user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleNone}, []accesscontrol.Permission{baseline, grant}},
				{"team", user.SignedInUser{UserID: 8, OrgID: 1, OrgRole: org.RoleNone, TeamIDs: []int64{10}}, []accesscontrol.Permission{baseline, grant}}, //nolint:staticcheck // Numeric RBAC team grants are distinct from contextual groups.
				{"basic", user.SignedInUser{UserID: 8, OrgID: 1, OrgRole: org.RoleViewer}, []accesscontrol.Permission{baseline, grant}},
				{"none", user.SignedInUser{UserID: 8, OrgID: 1, OrgRole: org.RoleNone}, []accesscontrol.Permission{baseline}},
				{"no-org-membership", user.SignedInUser{UserID: 7, OrgID: -1}, []accesscontrol.Permission{baseline}},
				{"no-org-membership-mapped-namespace", user.SignedInUser{UserID: 7, OrgID: -1, Namespace: "org--1"}, []accesscontrol.Permission{baseline}},
				{"service-account", user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleNone, IsServiceAccount: true}, []accesscontrol.Permission{baseline, grant}},
				{"anonymous-viewer", user.SignedInUser{IsAnonymous: true, OrgID: 1, OrgRole: org.RoleViewer}, []accesscontrol.Permission{baseline, grant}},
				{"anonymous-none", user.SignedInUser{IsAnonymous: true, OrgID: 1, OrgRole: org.RoleNone}, []accesscontrol.Permission{baseline}},
				{"renderer", user.SignedInUser{AuthenticatedBy: "render", OrgID: 1, OrgRole: org.RoleViewer}, []accesscontrol.Permission{baseline, grant}},
				{"user-backed-renderer", user.SignedInUser{UserID: 7, AuthenticatedBy: "render", OrgID: 1, OrgRole: org.RoleNone}, []accesscontrol.Permission{baseline, grant}},
				{"api-key", user.SignedInUser{ApiKeyID: 7, OrgID: 1, OrgRole: org.RoleViewer}, []accesscontrol.Permission{baseline, grant}},
				{"no-unique-id", user.SignedInUser{OrgID: 1, OrgRole: org.RoleNone}, []accesscontrol.Permission{baseline}},
				{"global-only", user.SignedInUser{UserID: 7, OrgID: 0, OrgRole: org.RoleViewer}, []accesscontrol.Permission{baseline}},
			} {
				t.Run(tc.name, func(t *testing.T) {
					got, err := s.GetUserPermissions(context.Background(), &tc.requester, accesscontrol.Options{})
					require.NoError(t, err)
					require.ElementsMatch(t, tc.want, got)
				})
			}
		})
	}
}

func TestIntegrationGetUserPermissions_ContractNoOrgMembership(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, cache := range []bool{false, true} {
		for _, scope := range []struct {
			name, stackID, memberNamespace, missingNamespace string
		}{
			{"unmapped", "", "", ""},
			{"self-managed", "", "default", "org--1"},
			{"cloud", "12", "stacks-12", "stacks-12"},
		} {
			t.Run(fmt.Sprintf("cache=%t/%s", cache, scope.name), func(t *testing.T) {
				s := setupTestEnv(t, false)
				s.cfg.RBAC.PermissionCache = cache
				s.cfg.StackID = scope.stackID
				baseline := accesscontrol.Permission{Action: "folders:read", Scope: "folders:uid:sharedwithme"}
				memberGrant := accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:member-org"}
				addContractUserGrant(t, s.sql, "managed:member-org", 1, 7, memberGrant)
				addContractUserGrant(t, s.sql, "managed:selected-org", 2, 7,
					accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:selected-org"})

				member := user.SignedInUser{UserID: 7, UserUID: "seven", OrgID: 1, OrgRole: org.RoleViewer}
				// GetSignedInUser normalizes a valid user without membership to
				// OrgID=-1 and an empty role. NamespaceSync may then map it to org--1.
				// These enumeration contracts accept that trusted identity, not HTTP headers.
				missing := user.SignedInUser{UserID: 7, UserUID: "seven", OrgID: -1}
				member.Namespace, missing.Namespace = scope.memberNamespace, scope.missingNamespace
				for _, step := range []struct {
					name      string
					requester user.SignedInUser
					options   accesscontrol.Options
					want      []accesscontrol.Permission
				}{
					{"member-cold", member, accesscontrol.Options{}, []accesscontrol.Permission{baseline, memberGrant}},
					{"no-membership-cold", missing, accesscontrol.Options{}, []accesscontrol.Permission{baseline}},
					{"no-membership-warm", missing, accesscontrol.Options{}, []accesscontrol.Permission{baseline}},
					{"no-membership-reload", missing, accesscontrol.Options{ReloadCache: true}, []accesscontrol.Permission{baseline}},
					{"member-after-no-membership", member, accesscontrol.Options{}, []accesscontrol.Permission{baseline, memberGrant}},
				} {
					t.Run(step.name, func(t *testing.T) {
						got, err := s.GetUserPermissions(t.Context(), &step.requester, step.options)
						require.NoError(t, err)
						require.ElementsMatch(t, step.want, rawPermissions(got))
					})
				}
			})
		}
	}
}

func TestIntegrationGetUserPermissions_ContractSourceCacheClear(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, cache := range []bool{false, true} {
		t.Run(fmt.Sprintf("cache=%t", cache), func(t *testing.T) {
			s := setupTestEnv(t, false)
			s.cfg.RBAC.PermissionCache = cache
			seedContractSources(t, s.sql)
			ctx := context.Background()
			requester := &user.SignedInUser{UserID: 7, OrgID: 1, OrgRole: org.RoleViewer, TeamIDs: []int64{10}} //nolint:staticcheck // Preserve numeric legacy RBAC membership in the cache contract.
			baseline := accesscontrol.Permission{Action: "folders:read", Scope: "folders:uid:sharedwithme"}
			a := accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:shared"}
			b := accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:changed"}
			check := func(options accesscontrol.Options, want []accesscontrol.Permission) {
				t.Helper()
				got, err := s.GetUserPermissions(ctx, requester, options)
				require.NoError(t, err)
				require.ElementsMatch(t, want, got)
			}
			check(accesscontrol.Options{}, []accesscontrol.Permission{baseline, a, a, a})
			require.NoError(t, s.sql.WithDbSession(ctx, func(sess *db.Session) error {
				_, err := sess.Exec("UPDATE permission SET scope = ? WHERE scope = ?", b.Scope, a.Scope)
				return err
			}))
			if cache {
				check(accesscontrol.Options{}, []accesscontrol.Permission{baseline, a, a, a})
			} else {
				check(accesscontrol.Options{}, []accesscontrol.Permission{baseline, b, b, b})
			}
			s.ClearUserPermissionCache(requester)
			if cache {
				// Clear refreshes the direct contribution, not the shared team or basic-role caches.
				check(accesscontrol.Options{}, []accesscontrol.Permission{baseline, b, a, a})
			} else {
				check(accesscontrol.Options{}, []accesscontrol.Permission{baseline, b, b, b})
			}
			check(accesscontrol.Options{ReloadCache: true}, []accesscontrol.Permission{baseline, b, b, b})
			check(accesscontrol.Options{}, []accesscontrol.Permission{baseline, b, b, b})
		})
	}
}
