package acimpl

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	apirequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestBuildLegacyCheckRequest(t *testing.T) {
	ac := ProvideAccessControlTest()
	requester := &user.SignedInUser{
		UserID:    42,
		UserUID:   "user-uid",
		OrgID:     1,
		Namespace: "stacks-123",
		TeamUIDs:  []string{"team-1", "team-2"},
	}
	evaluator := accesscontrol.EvalAll(
		accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:dash-1", "dashboards:uid:dash-2"),
		accesscontrol.EvalAny(
			accesscontrol.EvalPermission("users:create"),
			accesscontrol.EvalPermission("users:write", ""),
		),
	)
	expected := legacyclient.LegacyCheckRequest{
		Namespace:           "stacks-123",
		Subject:             "user:user-uid",
		Teams:               []string{"team-1", "team-2"},
		SkipCache:           false,
		SkipScopeResolution: false,
		Evaluator:           evaluator,
	}

	request, err := ac.buildLegacyCheckRequest(
		requester,
		evaluator,
		false,
		types.OrgNamespaceFormatter,
	)

	require.NoError(t, err)
	require.Equal(t, expected, request)

	requester.TeamUIDs[0] = "changed-team"

	require.Equal(t, expected, request)
}

func TestBuildLegacyCheckRequestIdentity(t *testing.T) {
	tests := []struct {
		name      string
		requester user.SignedInUser
		subject   string
	}{
		{
			name: "user UID",
			requester: user.SignedInUser{
				UserID:  42,
				UserUID: "user-uid",
				OrgID:   2,
			},
			subject: "user:user-uid",
		},
		{
			name: "service account UID",
			requester: user.SignedInUser{
				UserID:           43,
				UserUID:          "sa-uid",
				IsServiceAccount: true,
				OrgID:            2,
			},
			subject: "service-account:sa-uid",
		},
		{
			name: "anonymous",
			requester: user.SignedInUser{
				IsAnonymous: true,
				OrgID:       2,
			},
			subject: "anonymous:0",
		},
		{
			name: "render service",
			requester: user.SignedInUser{
				AuthenticatedBy: "render",
				OrgID:           2,
			},
			subject: "render:0",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ac := ProvideAccessControlTest()
			expected := legacyclient.LegacyCheckRequest{
				Namespace:           "org-2",
				Subject:             tc.subject,
				Evaluator:           accesscontrol.EvalPermission("dashboards:read"),
				Teams:               nil,
				SkipCache:           false,
				SkipScopeResolution: false,
			}

			request, err := ac.buildLegacyCheckRequest(
				&tc.requester,
				accesscontrol.EvalPermission("dashboards:read"),
				false,
				types.OrgNamespaceFormatter,
			)

			require.NoError(t, err)
			require.Equal(t, expected, request)
		})
	}
}

func TestBuildLegacyCheckRequestGroups(t *testing.T) {
	tests := []struct {
		name              string
		useExternalGroups bool
		externalGroups    []string
		expected          []string
	}{
		{
			name:           "stored teams when external groups are disabled",
			externalGroups: []string{"external-team"},
			expected:       []string{"stored-team"},
		},
		{
			name:              "external groups when enabled",
			useExternalGroups: true,
			externalGroups:    []string{"external-team"},
			expected:          []string{"external-team"},
		},
		{
			name:              "nil external groups do not fall back to stored teams",
			useExternalGroups: true,
		},
		{
			name:              "empty external groups do not fall back to stored teams",
			useExternalGroups: true,
			externalGroups:    []string{},
			expected:          []string{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ac := ProvideAccessControlTest()
			requester := &user.SignedInUser{
				UserID:         42,
				UserUID:        "user-uid",
				OrgID:          1,
				TeamUIDs:       []string{"stored-team"},
				ExternalGroups: tc.externalGroups,
			}

			request, err := ac.buildLegacyCheckRequest(
				requester,
				accesscontrol.EvalPermission("dashboards:read"),
				tc.useExternalGroups,
				types.OrgNamespaceFormatter,
			)

			require.NoError(t, err)
			require.Equal(t, tc.expected, request.Teams)

			requester.TeamUIDs[0] = "changed-stored-team"
			if len(requester.ExternalGroups) > 0 {
				requester.ExternalGroups[0] = "changed-external-team"
			}
			require.Equal(t, tc.expected, request.Teams)
		})
	}
}

func TestBuildLegacyCheckRequestWithoutResolvers(t *testing.T) {
	ac := ProvideAccessControlTest()
	withoutResolvers := ac.WithoutResolvers().(*AccessControl)
	requester := &user.SignedInUser{
		UserID:         42,
		UserUID:        "user-uid",
		OrgID:          1,
		Namespace:      "stacks-123",
		TeamUIDs:       []string{"stored-team"},
		ExternalGroups: []string{"external-team"},
	}
	evaluator := accesscontrol.EvalPermission("dashboards:read", "dashboards:id:1")

	for _, tc := range []struct {
		name                string
		ac                  *AccessControl
		skipScopeResolution bool
	}{
		{name: "without resolvers", ac: withoutResolvers, skipScopeResolution: true},
		{name: "without resolvers called twice", ac: withoutResolvers.WithoutResolvers().(*AccessControl), skipScopeResolution: true},
		{name: "original instance still resolves scopes", ac: ac},
	} {
		t.Run(tc.name, func(t *testing.T) {
			request, err := tc.ac.buildLegacyCheckRequest(
				requester,
				evaluator,
				true,
				types.OrgNamespaceFormatter,
			)

			require.NoError(t, err)
			expected := legacyclient.LegacyCheckRequest{
				Namespace:           "stacks-123",
				Subject:             "user:user-uid",
				Evaluator:           accesscontrol.EvalPermission("dashboards:read", "dashboards:id:1"),
				Teams:               []string{"external-team"},
				SkipScopeResolution: tc.skipScopeResolution,
			}
			require.Equal(t, expected, request)
		})
	}
}

func TestBuildLegacyCheckRequestRejectsInvalidInput(t *testing.T) {
	tests := []struct {
		name      string
		requester identity.Requester
		evaluator accesscontrol.Evaluator
		error     string
	}{
		{
			name:      "nil requester",
			requester: nil,
			evaluator: accesscontrol.EvalPermission("dashboards:read"),
			error:     "legacy check requester is required",
		},
		{
			name:      "typed nil requester",
			requester: (*user.SignedInUser)(nil),
			evaluator: accesscontrol.EvalPermission("dashboards:read"),
			error:     "legacy check requester is required",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ac := ProvideAccessControlTest()

			request, err := ac.buildLegacyCheckRequest(
				tc.requester,
				tc.evaluator,
				false,
				types.OrgNamespaceFormatter,
			)

			require.ErrorContains(t, err, tc.error)
			require.Empty(t, request)
		})
	}
}

func TestBuildLegacyCheckRequestGlobalEvaluation(t *testing.T) {
	for _, tc := range []struct {
		name             string
		orgID            int64
		namespace        string
		stackID          string
		permissions      map[int64]map[string][]string
		wantNamespace    string
		permittedActions []string
	}{
		{
			name:             "NoOrgID with a global map",
			orgID:            accesscontrol.NoOrgID,
			namespace:        "stacks-123",
			permissions:      map[int64]map[string][]string{0: {"users:read": {"users:*"}}},
			wantNamespace:    "stacks-123",
			permittedActions: []string{"users:read"},
		},
		{
			name:          "organization map does not count as global",
			orgID:         accesscontrol.NoOrgID,
			namespace:     "org--1",
			permissions:   map[int64]map[string][]string{12: {"users:read": {"users:*"}}},
			wantNamespace: "default",
		},
		{
			name:          "minus one map does not count as global",
			orgID:         accesscontrol.NoOrgID,
			permissions:   map[int64]map[string][]string{-1: {"users:read": {"users:*"}}},
			wantNamespace: "default",
		},
		{
			name:             "explicit global identity",
			orgID:            accesscontrol.GlobalOrgID,
			namespace:        "org-0",
			permissions:      map[int64]map[string][]string{0: {"users:read": {"users:*"}}},
			wantNamespace:    "default",
			permittedActions: []string{"users:read"},
		},
		{
			name:          "global identity with empty global map",
			orgID:         accesscontrol.GlobalOrgID,
			namespace:     "stacks-123",
			permissions:   map[int64]map[string][]string{0: {}},
			wantNamespace: "stacks-123",
		},
		{
			name:             "cloud NoOrgID with empty namespace",
			orgID:            accesscontrol.NoOrgID,
			stackID:          "123",
			permissions:      map[int64]map[string][]string{0: {"users:read": {"users:*"}}},
			wantNamespace:    "stacks-123",
			permittedActions: []string{"users:read"},
		},
		{
			name:             "cloud global identity with empty namespace",
			orgID:            accesscontrol.GlobalOrgID,
			stackID:          "123",
			permissions:      map[int64]map[string][]string{0: {"users:read": {"users:*"}}},
			wantNamespace:    "stacks-123",
			permittedActions: []string{"users:read"},
		},
		{
			name:             "cloud NoOrgID with sentinel namespace",
			orgID:            accesscontrol.NoOrgID,
			namespace:        "org--1",
			stackID:          "123",
			permissions:      map[int64]map[string][]string{0: {"users:read": {"users:*"}}},
			wantNamespace:    "stacks-123",
			permittedActions: []string{"users:read"},
		},
		{
			name:             "cloud global identity with sentinel namespace",
			orgID:            accesscontrol.GlobalOrgID,
			namespace:        "org-0",
			stackID:          "123",
			permissions:      map[int64]map[string][]string{0: {"users:read": {"users:*"}}},
			wantNamespace:    "stacks-123",
			permittedActions: []string{"users:read"},
		},
		{
			name:             "explicit namespace is preserved for server validation",
			orgID:            accesscontrol.GlobalOrgID,
			namespace:        "stacks-456",
			stackID:          "123",
			permissions:      map[int64]map[string][]string{0: {"users:read": {"users:*"}}},
			wantNamespace:    "stacks-456",
			permittedActions: []string{"users:read"},
		},
		{
			name:      "effective action list includes resolver dependencies in sorted order",
			orgID:     accesscontrol.NoOrgID,
			namespace: "stacks-123",
			permissions: map[int64]map[string][]string{
				0:  {"users:read": {"users:*"}, "folders:read": {"folders:*"}},
				12: {"users:delete": {"users:*"}},
			},
			wantNamespace:    "stacks-123",
			permittedActions: []string{"folders:read", "users:read"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.StackID = tc.stackID

			requester := &user.SignedInUser{
				UserID:      1,
				UserUID:     "user-uid",
				OrgID:       tc.orgID,
				Namespace:   tc.namespace,
				Permissions: tc.permissions,
			}
			want := legacyclient.LegacyCheckRequest{
				Namespace: tc.wantNamespace,
				Subject:   "user:user-uid",
				Evaluator: accesscontrol.EvalPermission("users:read"),
				GlobalEvaluation: &legacyclient.LegacyGlobalEvaluation{
					RequesterOrgID:   tc.orgID,
					PermittedActions: tc.permittedActions,
				},
			}

			useExternalGroups := false
			got, err := ProvideAccessControlTest().
				buildLegacyCheckRequest(
					requester,
					accesscontrol.EvalPermission("users:read"),
					useExternalGroups,
					apirequest.GetNamespaceMapper(cfg),
				)
			require.NoError(t, err)
			require.Equal(t, want, got)
		})
	}
}

func TestBuildLegacyCheckRequestCloudOrganization(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.StackID = "123"
	requester := &user.SignedInUser{
		UserID:  1,
		UserUID: "user-uid",
		OrgID:   1,
	}
	want := legacyclient.LegacyCheckRequest{
		Namespace: "stacks-123",
		Subject:   "user:user-uid",
		Evaluator: accesscontrol.EvalPermission("users:read"),
	}

	got, err := ProvideAccessControlTest().buildLegacyCheckRequest(
		requester,
		accesscontrol.EvalPermission("users:read"),
		false,
		apirequest.GetNamespaceMapper(cfg),
	)

	require.NoError(t, err)
	require.Equal(t, want, got)
}
