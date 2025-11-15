package preferences

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
)

type expect struct {
	decision authorizer.Decision
	reason   string
	err      string
}

type testCase struct {
	name       string
	user       identity.Requester
	attrs      authorizer.Attributes
	expect     expect
	breakpoint bool
}

func TestAuthorizer_Authorize(t *testing.T) {
	userABC := &identity.StaticRequester{
		UserUID: "abc",
		OrgRole: identity.RoleViewer,
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{
				DelegatedPermissions: []string{"group/stars:*", "group/preferences:*", "group/ns:*"},
			},
		},
	}

	tests := []struct {
		name     string
		teams    func(t *testing.T) utils.TeamService
		resource map[string][]utils.ResourceOwner
		check    []testCase
	}{
		{
			name: "stars",
			resource: map[string][]utils.ResourceOwner{
				"stars": {utils.UserResourceOwner},
			},
			check: []testCase{{
				name: "matches user",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					Verb:            "get",
					APIGroup:        "group",
					Resource:        "stars",
					Name:            "user-abc", // note this matches in input user name
					ResourceRequest: true,
				},
				expect: expect{
					decision: authorizer.DecisionAllow,
				},
			}, {
				name: "different user",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					Verb:            "get",
					APIGroup:        "group",
					Resource:        "stars",
					Name:            "user-xyz", // not abc
					ResourceRequest: true,
				},
				expect: expect{
					decision: authorizer.DecisionDeny,
					reason:   "your are not the owner of the resource",
				},
			}},
		}, {
			name: "fast path",
			resource: map[string][]utils.ResourceOwner{
				"stars":       {utils.UserResourceOwner},
				"preferences": {utils.TeamResourceOwner},
			},
			check: []testCase{{
				name:  "missing user",
				attrs: authorizer.AttributesRecord{},
				expect: expect{
					decision: authorizer.DecisionDeny,
					err:      "a Requester was not found in the context",
				},
			}, {
				name: "not a resource",
				user: &identity.StaticRequester{},
				attrs: authorizer.AttributesRecord{
					ResourceRequest: false,
				},
				expect: expect{
					decision: authorizer.DecisionNoOpinion,
				},
			}, {
				name: "unknown resource",
				user: &identity.StaticRequester{},
				attrs: authorizer.AttributesRecord{
					Resource:        "xxxx",
					ResourceRequest: true,
				},
				expect: expect{
					decision: authorizer.DecisionDeny,
					reason:   "missing resource name",
				},
			}, {
				name: "missing service permissions",
				user: &identity.StaticRequester{
					UserUID: "abc",
					AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
						Rest: authn.AccessTokenClaims{
							DelegatedPermissions: []string{""},
						},
					},
				},
				attrs: authorizer.AttributesRecord{
					Resource:        "stars",
					ResourceRequest: true,
				},
				expect: expect{
					decision: authorizer.DecisionDeny,
					reason:   "calling service lacks required permissions",
				},
			}, {
				name: "wrong owner type",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					APIGroup:        "group",
					Resource:        "stars",
					ResourceRequest: true,
					Verb:            "create",   // missing name
					Name:            "team-xxx", // not supported
				},
				expect: expect{
					decision: authorizer.DecisionDeny,
					reason:   "unsupported owner type",
				},
			}, {
				name: "unknown resource",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					APIGroup:        "group",
					Resource:        "stars",
					ResourceRequest: true,
					Verb:            "create", // missing name
				},
				expect: expect{
					decision: authorizer.DecisionDeny,
					reason:   "mutating request without a name",
				},
			}, {
				name: "list request",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					APIGroup:        "group",
					Resource:        "stars",
					ResourceRequest: true,
					Verb:            "list", // no name
				},
				expect: expect{
					decision: authorizer.DecisionAllow,
				},
			}, {
				name: "teams request (but not configured)",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					APIGroup:        "group",
					Resource:        "preferences",
					ResourceRequest: true,
					Verb:            "get",
					Name:            "team-XYZ",
				},
				expect: expect{
					decision: authorizer.DecisionDeny,
					reason:   "team checker not configured",
				},
			}},
		}, {
			name: "unknown owner",
			resource: map[string][]utils.ResourceOwner{
				"stars": {utils.UnknownResourceOwner},
			},
			check: []testCase{{
				name: "get",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					APIGroup:        "group",
					Resource:        "stars",
					Name:            "something-not-an-owner",
					ResourceRequest: true,
					Verb:            "get",
				},
				expect: expect{
					decision: authorizer.DecisionAllow,
				},
			}},
		}, {
			name: "namespace",
			resource: map[string][]utils.ResourceOwner{
				"ns": {utils.NamespaceResourceOwner},
			},
			check: []testCase{{
				name: "readonly",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					APIGroup:        "group",
					Resource:        "ns",
					ResourceRequest: true,
					Verb:            "get",
					Name:            "namespace",
				},
				expect: expect{
					decision: authorizer.DecisionAllow,
				},
			}, {
				name: "mutating",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					APIGroup:        "group",
					Resource:        "ns",
					ResourceRequest: true,
					Verb:            "create",
					Name:            "namespace",
				},
				expect: expect{
					decision: authorizer.DecisionDeny,
					reason:   "must be an org admin to edit",
				},
			}, {
				name: "org admin",
				user: &identity.StaticRequester{
					UserUID: "abc",
					OrgRole: identity.RoleAdmin,
					AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
						Rest: authn.AccessTokenClaims{
							DelegatedPermissions: []string{"group/ns:create"},
						},
					},
				},
				attrs: authorizer.AttributesRecord{
					APIGroup:        "group",
					Resource:        "ns",
					ResourceRequest: true,
					Verb:            "create",
					Name:            "namespace",
				},
				expect: expect{
					decision: authorizer.DecisionAllow,
				},
			}},
		}, {
			name: "preferences teams",
			teams: func(t *testing.T) utils.TeamService {
				teams := utils.NewMockTeamService(t)
				teams.On("InTeam", mock.Anything, userABC, "xyz", false).Return(true, nil)
				teams.On("InTeam", mock.Anything, userABC, "456", false).Return(false, nil)
				teams.On("InTeam", mock.Anything, userABC, "XXX", false).Return(true, fmt.Errorf("error from team"))
				return teams
			},
			resource: map[string][]utils.ResourceOwner{
				"preferences": {
					utils.TeamResourceOwner,
				},
			},
			check: []testCase{{
				name: "user in team",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					Verb:            "get",
					APIGroup:        "group",
					Resource:        "preferences",
					Name:            "team-xyz",
					ResourceRequest: true,
				},
				expect: expect{
					decision: authorizer.DecisionAllow,
				},
			}, {
				name: "user not in team",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					Verb:            "get",
					APIGroup:        "group",
					Resource:        "preferences",
					Name:            "team-456",
					ResourceRequest: true,
				},
				expect: expect{
					decision: authorizer.DecisionDeny,
					reason:   "you are not a member of the referenced team",
				},
			}, {
				name: "team error",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					Verb:            "get",
					APIGroup:        "group",
					Resource:        "preferences",
					Name:            "team-XXX",
					ResourceRequest: true,
				},
				expect: expect{
					decision: authorizer.DecisionDeny,
					reason:   "error fetching teams",
					err:      "error from team",
				},
			}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			authz := &authorizeFromName{
				resource: tt.resource,
			}
			if tt.teams != nil {
				authz.teams = tt.teams(t)
			}
			for _, check := range tt.check {
				t.Run(check.name, func(t *testing.T) {
					ctx := context.Background()
					if check.user != nil {
						ctx = identity.WithRequester(ctx, check.user)
					}
					e := check.expect
					if check.breakpoint {
						require.True(t, true) // Can set breakpoint in IDE here
					}
					d, r, err := authz.Authorize(ctx, check.attrs)
					if e.err != "" {
						require.ErrorContains(t, err, e.err)
						return
					}
					require.NoError(t, err)
					require.Equal(t, e.decision, d)
					if e.reason != "" {
						require.Equal(t, e.reason, r)
					}
				})
			}
		})
	}
}
