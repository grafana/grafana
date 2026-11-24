package rbac

import (
	"context"
	"fmt"
	"slices"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/shadow"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
)

const legacyGrantedTeamID int64 = 42

func TestLegacyCheckTeamMembershipSnapshot(t *testing.T) {
	for _, tc := range []struct {
		name        string
		teamIDs     []int64
		wantIDs     []int64
		wantCalls   int
		wantAllowed bool
	}{
		{name: "supplied", teamIDs: []int64{legacyGrantedTeamID}, wantIDs: []int64{legacyGrantedTeamID}, wantAllowed: true},
		{name: "explicitly empty", teamIDs: []int64{}, wantIDs: []int64{}},
		{name: "unavailable falls back", wantIDs: []int64{legacyGrantedTeamID}, wantCalls: 1, wantAllowed: true},
	} {
		for _, skipCache := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/skipCache=%t", tc.name, skipCache), func(t *testing.T) {
				s := NewTestService("checked-user", nil, nil)
				memberships := s.identityStore.(*fakeIdentityStore)
				memberships.userTeams = []int64{legacyGrantedTeamID}
				// A supplied snapshot must work even when the membership store is unavailable.
				memberships.err = tc.teamIDs != nil
				permissions := &legacyTeamGrantStore{}
				s.permissionStore = permissions
				client := newEmbeddedLegacyCheckTestClient(s)

				allowed, err := client.LegacyCheck(t.Context(), legacyclient.LegacyCheckRequest{
					Namespace: "org-12", RequesterOrgID: proto.Int64(12), Subject: "user:checked-user",
					TeamIDs: tc.teamIDs, SkipCache: skipCache,
					Evaluator: accesscontrol.EvalPermission("dashboards:read", "folders:uid:parent"),
				})

				require.NoError(t, err)
				require.Equal(t, tc.wantAllowed, allowed)
				require.Equal(t, tc.wantCalls, memberships.calls)
				require.Equal(t, []store.PermissionsQuery{{UserID: 1, TeamIDs: tc.wantIDs, Action: "dashboards:read"}}, permissions.queries)
				if tc.teamIDs != nil {
					_, found := s.userTeamCache.Get(t.Context(), userTeamCacheKey("org-12", "checked-user"))
					require.False(t, found, "request snapshots must not populate the shared membership cache")
				}
			})
		}
	}
}

func TestLegacyCheckTeamSnapshotResolverDependencies(t *testing.T) {
	for _, isShadow := range []bool{false, true} {
		t.Run(fmt.Sprintf("shadow=%t", isShadow), func(t *testing.T) {
			ac := acimpl.ProvideAccessControlTest()
			resolverCalls := 0
			ac.RegisterScopeAttributeResolver("library.panels:uid:", accesscontrol.WithRequiredActions(accesscontrol.ScopeAttributeResolverFunc(
				func(ctx context.Context, _ int64, _ string) ([]string, error) {
					resolverCalls++
					requester, err := identity.GetRequester(ctx)
					require.NoError(t, err)
					require.True(t, accesscontrol.EvalPermission("folders:read", "folders:uid:parent").Evaluate(requester.GetPermissions()))
					return []string{"folders:uid:parent"}, nil
				},
			), "folders:read"))
			s := NewTestService("checked-user", nil, nil).WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
			memberships := s.identityStore.(*fakeIdentityStore)
			memberships.err = true
			permissions := &legacyTeamGrantStore{}
			s.permissionStore = permissions
			cacheKey := userTeamCacheKey("org-12", "checked-user")
			cachedTeams := []int64{99}
			s.userTeamCache.Set(t.Context(), cacheKey, cachedTeams)
			ctx := t.Context()
			if isShadow {
				ctx = shadow.WithContext(ctx)
			}

			allowed, err := newEmbeddedLegacyCheckTestClient(s).LegacyCheck(ctx, legacyclient.LegacyCheckRequest{
				Namespace: "org-12", RequesterOrgID: proto.Int64(12), Subject: "user:checked-user",
				TeamIDs: []int64{legacyGrantedTeamID}, SkipCache: true,
				Evaluator: accesscontrol.EvalPermission("library.panels:read", "library.panels:uid:panel"),
			})

			require.NoError(t, err)
			require.True(t, allowed)
			require.Equal(t, 1, resolverCalls)
			require.Zero(t, memberships.calls)
			require.Equal(t, []store.PermissionsQuery{
				{UserID: 1, TeamIDs: []int64{legacyGrantedTeamID}, Action: "library.panels:read"},
				{UserID: 1, TeamIDs: []int64{legacyGrantedTeamID}, Action: "folders:read"},
			}, permissions.queries)
			got, found := s.userTeamCache.Get(t.Context(), cacheKey)
			require.True(t, found)
			require.Equal(t, cachedTeams, got)
		})
	}
}

func TestLegacyCheckTeamSnapshotValidation(t *testing.T) {
	for _, tc := range []struct {
		name      string
		embedded  bool
		modify    func(*authzv1.LegacyCheckRequest)
		wantError string
	}{
		{name: "ordinary registration", wantError: "legacy team memberships require the embedded server"},
		{name: "zero ID", embedded: true, modify: func(r *authzv1.LegacyCheckRequest) { r.TeamIds.Ids = []int64{0} }, wantError: "legacy team IDs must be positive"},
		{name: "negative ID", embedded: true, modify: func(r *authzv1.LegacyCheckRequest) { r.TeamIds.Ids = []int64{-1} }, wantError: "legacy team IDs must be positive"},
		{name: "global", embedded: true, modify: func(r *authzv1.LegacyCheckRequest) { r.RequesterOrgId = proto.Int64(0) }, wantError: "legacy team memberships require an organization user or service account"},
		{name: "anonymous", embedded: true, modify: func(r *authzv1.LegacyCheckRequest) { r.Subject = "anonymous:0" }, wantError: "legacy team memberships require an organization user or service account"},
		{name: "internal", embedded: true, modify: func(r *authzv1.LegacyCheckRequest) {
			r.Subject = ""
			r.InternalIdentity = &authzv1.LegacyInternalIdentity{Profile: "service"}
		}, wantError: "legacy team memberships require an organization user or service account"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := NewTestService("checked-user", nil, nil)
			s.store, s.identityStore, s.permissionStore = nil, nil, nil
			req := &authzv1.LegacyCheckRequest{
				Namespace: "org-12", RequesterOrgId: proto.Int64(12), Subject: "user:checked-user",
				TeamIds:    &authzv1.LegacyTeamIDs{Ids: []int64{legacyGrantedTeamID}},
				Expression: legacyPermissionExpression("dashboards:read", "folders:uid:parent"),
			}
			if tc.modify != nil {
				tc.modify(req)
			}
			check := s.LegacyCheck
			if tc.embedded {
				check = (&embeddedLegacyCheckServer{service: s}).LegacyCheck
			}
			got, err := check(legacyCheckContext(t), req)
			require.NoError(t, err)
			require.Equal(t, &authzv1.LegacyCheckResponse{Error: tc.wantError}, got)
		})
	}
}

type legacyTeamGrantStore struct {
	store.PermissionStore
	queries []store.PermissionsQuery
}

func (s *legacyTeamGrantStore) GetUserPermissions(_ context.Context, _ types.NamespaceInfo, query store.PermissionsQuery) ([]accesscontrol.Permission, error) {
	s.queries = append(s.queries, query)
	if !slices.Contains(query.TeamIDs, legacyGrantedTeamID) {
		return nil, nil
	}
	return []accesscontrol.Permission{{Action: query.Action, Scope: "folders:uid:parent"}}, nil
}
