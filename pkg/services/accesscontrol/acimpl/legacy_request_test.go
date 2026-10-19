package acimpl

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/testing/protocmp"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/user"
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
	expected := &authzextv1.LegacyCheckRequest{
		Namespace:           "stacks-123",
		Subject:             "user:user-uid",
		Teams:               []string{"team-1", "team-2"},
		SkipCache:           false,
		SkipScopeResolution: false,
		Expression: &authzextv1.LegacyExpression{
			Node: &authzextv1.LegacyExpression_All{
				All: &authzextv1.LegacyExpressionList{
					Expressions: []*authzextv1.LegacyExpression{
						legacyRequestPermissionExpression(
							"dashboards:read",
							"dashboards:uid:dash-1",
							"dashboards:uid:dash-2",
						),
						{
							Node: &authzextv1.LegacyExpression_Any{
								Any: &authzextv1.LegacyExpressionList{
									Expressions: []*authzextv1.LegacyExpression{
										legacyRequestPermissionExpression("users:create"),
										legacyRequestPermissionExpression("users:write", ""),
									},
								},
							},
						},
					},
				},
			},
		},
	}

	request, err := ac.buildLegacyCheckRequest(requester, evaluator, false)

	require.NoError(t, err)
	require.Empty(t, cmp.Diff(expected, request, protocmp.Transform()))

	requester.TeamUIDs[0] = "changed-team"

	require.Empty(t, cmp.Diff(expected, request, protocmp.Transform()))
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
			expected := &authzextv1.LegacyCheckRequest{
				Namespace:           "org-2",
				Subject:             tc.subject,
				Expression:          legacyRequestPermissionExpression("dashboards:read"),
				Teams:               nil,
				SkipCache:           false,
				SkipScopeResolution: false,
			}

			request, err := ac.buildLegacyCheckRequest(&tc.requester, accesscontrol.EvalPermission("dashboards:read"), false)

			require.NoError(t, err)
			require.Empty(t, cmp.Diff(expected, request, protocmp.Transform()))
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

			request, err := ac.buildLegacyCheckRequest(requester, accesscontrol.EvalPermission("dashboards:read"), tc.useExternalGroups)

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
			request, err := tc.ac.buildLegacyCheckRequest(requester, evaluator, true)

			require.NoError(t, err)
			expected := &authzextv1.LegacyCheckRequest{
				Namespace:           "stacks-123",
				Subject:             "user:user-uid",
				Expression:          legacyRequestPermissionExpression("dashboards:read", "dashboards:id:1"),
				Teams:               []string{"external-team"},
				SkipScopeResolution: tc.skipScopeResolution,
			}
			require.Empty(t, cmp.Diff(expected, request, protocmp.Transform()))
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
		{
			name: "global evaluation cannot be expressed as a namespace",
			requester: &user.SignedInUser{
				UserID:    1,
				UserUID:   "user-uid",
				OrgID:     accesscontrol.NoOrgID,
				Namespace: "stacks-123",
			},
			evaluator: accesscontrol.EvalPermission("users:read"),
			error:     "legacy check does not yet support global evaluation",
		},
		{
			name: "unsupported evaluator",
			requester: &user.SignedInUser{
				UserID:  1,
				UserUID: "user-uid",
				OrgID:   1,
			},
			evaluator: unsupportedLegacyRequestEvaluator{},
			error:     "unsupported legacy evaluator type",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ac := ProvideAccessControlTest()

			request, err := ac.buildLegacyCheckRequest(tc.requester, tc.evaluator, false)

			require.ErrorContains(t, err, tc.error)
			require.Nil(t, request)
		})
	}
}

func legacyRequestPermissionExpression(
	action string,
	scopes ...string,
) *authzextv1.LegacyExpression {
	return &authzextv1.LegacyExpression{
		Node: &authzextv1.LegacyExpression_Permission{
			Permission: &authzextv1.LegacyPermission{
				Action: action,
				Scopes: scopes,
			},
		},
	}
}

type unsupportedLegacyRequestEvaluator struct {
	accesscontrol.Evaluator
}
