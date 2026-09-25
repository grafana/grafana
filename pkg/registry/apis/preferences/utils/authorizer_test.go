package utils

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
		Groups:  []string{"XYZ"},
		OrgRole: identity.RoleViewer,
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{
				DelegatedPermissions: []string{"group/stars:*", "group/preferences:*", "group/ns:*"},
			},
		},
	}

	// Access policy (service) identity with explicit token permissions rather
	// than delegated (on-behalf-of) permissions.
	serviceStars := &identity.StaticRequester{
		Type:    authlib.TypeAccessPolicy,
		UserUID: "svc",
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{
				Permissions: []string{"group/stars:*"},
			},
		},
	}
	serviceNoPerms := &identity.StaticRequester{
		Type:    authlib.TypeAccessPolicy,
		UserUID: "svc",
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{
				Permissions: []string{""},
			},
		},
	}
	orgAdmin := &identity.StaticRequester{
		UserUID: "admin",
		Groups:  []string{}, // not a member of any team
		OrgRole: identity.RoleAdmin,
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{
				DelegatedPermissions: []string{"group/preferences:*"},
			},
		},
	}

	tests := []struct {
		name          string
		resource      map[string][]ResourceOwner
		allowOrgAdmin bool
		okNames       []string
		accessClient  authlib.AccessClient
		check         []testCase
	}{
		{
			name: "stars",
			resource: map[string][]ResourceOwner{
				"stars": {UserResourceOwner},
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
					Name:            "user-XYZ", // not abc
					ResourceRequest: true,
				},
				expect: expect{
					decision: authorizer.DecisionDeny,
					reason:   "your are not the owner of the resource",
				},
			}},
		}, {
			name: "fast path",
			resource: map[string][]ResourceOwner{
				"stars":       {UserResourceOwner},
				"preferences": {TeamResourceOwner},
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
				name: "teams request",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					APIGroup:        "group",
					Resource:        "preferences",
					ResourceRequest: true,
					Verb:            "get",
					Name:            "team-XYZ",
				},
				expect: expect{
					decision: authorizer.DecisionAllow,
				},
			}, {
				name: "teams request (bad)",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					APIGroup:        "group",
					Resource:        "preferences",
					ResourceRequest: true,
					Verb:            "get",
					Name:            "team-zzz",
				},
				expect: expect{
					decision: authorizer.DecisionDeny,
					reason:   "no edit permissions for the team",
				},
			}},
		}, {
			name: "unknown owner",
			resource: map[string][]ResourceOwner{
				"stars": {UnknownResourceOwner},
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
			resource: map[string][]ResourceOwner{
				"ns": {NamespaceResourceOwner},
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
			resource: map[string][]ResourceOwner{
				"preferences": {
					TeamResourceOwner,
				},
			},
			check: []testCase{{
				name: "user in team",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					Verb:            "get",
					APIGroup:        "group",
					Resource:        "preferences",
					Name:            "team-XYZ",
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
					reason:   "no edit permissions for the team",
				},
			}},
		}, {
			name: "service call",
			resource: map[string][]ResourceOwner{
				"stars": {UserResourceOwner},
			},
			check: []testCase{{
				// An access policy with explicit permissions is allowed before
				// any name/owner checks run - even a mutating request with no name
				// (which would otherwise be denied).
				name: "allowed for mutating request without a name",
				user: serviceStars,
				attrs: authorizer.AttributesRecord{
					APIGroup:        "group",
					Resource:        "stars",
					ResourceRequest: true,
					Verb:            "create", // missing name
				},
				expect: expect{
					decision: authorizer.DecisionAllow,
				},
			}, {
				// The owner would not otherwise match this service identity, but
				// the explicit service permissions short-circuit the check.
				name: "allowed regardless of owner",
				user: serviceStars,
				attrs: authorizer.AttributesRecord{
					APIGroup:        "group",
					Resource:        "stars",
					ResourceRequest: true,
					Verb:            "delete",
					Name:            "user-someone-else",
				},
				expect: expect{
					decision: authorizer.DecisionAllow,
				},
			}, {
				name: "denied without service permissions",
				user: serviceNoPerms,
				attrs: authorizer.AttributesRecord{
					APIGroup:        "group",
					Resource:        "stars",
					ResourceRequest: true,
					Verb:            "get",
					Name:            "user-svc",
				},
				expect: expect{
					decision: authorizer.DecisionDeny,
					reason:   "calling service lacks required permissions",
				},
			}},
		}, {
			name:          "allow org admin",
			allowOrgAdmin: true,
			resource: map[string][]ResourceOwner{
				"preferences": {TeamResourceOwner},
			},
			check: []testCase{{
				// With AllowOrgAdmin, an org admin is allowed before the owner
				// checks - here for a team they are not a member of.
				name: "org admin bypasses owner checks",
				user: orgAdmin,
				attrs: authorizer.AttributesRecord{
					Verb:            "get",
					APIGroup:        "group",
					Resource:        "preferences",
					Name:            "team-zzz", // admin is not in this team
					ResourceRequest: true,
				},
				expect: expect{
					decision: authorizer.DecisionAllow,
				},
			}, {
				// A non-admin still follows the normal owner checks.
				name: "non-admin is not bypassed",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					Verb:            "get",
					APIGroup:        "group",
					Resource:        "preferences",
					Name:            "team-456", // not a group userABC belongs to
					ResourceRequest: true,
				},
				expect: expect{
					decision: authorizer.DecisionDeny,
					reason:   "no edit permissions for the team",
				},
			}},
		}, {
			// Without AllowOrgAdmin, an org admin gets no special treatment and
			// falls through to the normal owner checks.
			name: "org admin not allowed when AllowOrgAdmin is false",
			resource: map[string][]ResourceOwner{
				"preferences": {TeamResourceOwner},
			},
			check: []testCase{{
				name: "org admin follows owner checks",
				user: orgAdmin,
				attrs: authorizer.AttributesRecord{
					Verb:            "get",
					APIGroup:        "group",
					Resource:        "preferences",
					Name:            "team-zzz",
					ResourceRequest: true,
				},
				expect: expect{
					decision: authorizer.DecisionDeny,
					reason:   "no edit permissions for the team",
				},
			}},
		}, {
			name:    "ok names",
			okNames: []string{"special"},
			resource: map[string][]ResourceOwner{
				"stars": {UserResourceOwner},
			},
			check: []testCase{{
				// A name in OKNames is a pseudo sub-resource that is always allowed.
				name: "allowed pseudo sub-resource",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					Verb:            "get",
					APIGroup:        "group",
					Resource:        "stars",
					Name:            "special",
					ResourceRequest: true,
				},
				expect: expect{
					decision: authorizer.DecisionAllow,
				},
			}, {
				// A name not in OKNames falls through to the normal owner checks.
				name: "other name follows owner checks",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					Verb:            "get",
					APIGroup:        "group",
					Resource:        "stars",
					Name:            "user-XYZ", // not abc
					ResourceRequest: true,
				},
				expect: expect{
					decision: authorizer.DecisionDeny,
					reason:   "your are not the owner of the resource",
				},
			}},
		}, {
			name:         "team access client error",
			accessClient: &errAccessClient{err: errors.New("boom")},
			resource: map[string][]ResourceOwner{
				"preferences": {TeamResourceOwner},
			},
			check: []testCase{{
				// An error checking team permissions is surfaced as a denial.
				name: "surfaces the error",
				user: userABC,
				attrs: authorizer.AttributesRecord{
					Verb:            "get",
					APIGroup:        "group",
					Resource:        "preferences",
					Name:            "team-456", // not a group userABC belongs to
					ResourceRequest: true,
				},
				expect: expect{
					decision: authorizer.DecisionDeny,
					reason:   "error fetching team permissions",
					err:      "boom",
				},
			}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			accessClient := tt.accessClient
			if accessClient == nil {
				accessClient = authlib.FixedAccessClient(false)
			}
			authz := &AuthorizeFromName{
				Resource:      tt.resource,
				AllowOrgAdmin: tt.allowOrgAdmin,
				OKNames:       tt.okNames,
				AccessClient:  accessClient,
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

func TestAuthorizer_TeamAccessClient(t *testing.T) {
	resource := map[string][]ResourceOwner{
		"preferences": {TeamResourceOwner},
	}
	adminNotInTeam := &identity.StaticRequester{
		UserUID: "admin-not-in-team",
		Groups:  []string{}, // not a member of any team
		OrgRole: identity.RoleAdmin,
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{
				DelegatedPermissions: []string{"group/preferences:*"},
			},
		},
	}

	t.Run("admin without group membership can get via IAM", func(t *testing.T) {
		authz := &AuthorizeFromName{
			AccessClient: authlib.FixedAccessClient(true),
			Resource:     resource,
		}
		ctx := identity.WithRequester(context.Background(), adminNotInTeam)
		d, _, err := authz.Authorize(ctx, authorizer.AttributesRecord{
			Verb:            "get",
			APIGroup:        "group",
			Resource:        "preferences",
			Name:            "team-XYZ",
			ResourceRequest: true,
		})
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionAllow, d)
	})

	t.Run("admin without group membership and without IAM permission is denied", func(t *testing.T) {
		authz := &AuthorizeFromName{
			AccessClient: authlib.FixedAccessClient(false),
			Resource:     resource,
		}
		ctx := identity.WithRequester(context.Background(), adminNotInTeam)
		d, reason, err := authz.Authorize(ctx, authorizer.AttributesRecord{
			Verb:            "get",
			APIGroup:        "group",
			Resource:        "preferences",
			Name:            "team-XYZ",
			ResourceRequest: true,
		})
		require.NoError(t, err)
		require.Equal(t, authorizer.DecisionDeny, d)
		require.NotEmpty(t, reason)
	})
}

// errAccessClient is an AccessClient whose Check always returns an error, used
// to exercise the team permission error path.
type errAccessClient struct {
	err error
}

func (c *errAccessClient) Check(_ context.Context, _ authlib.AuthInfo, _ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{}, c.err
}

func (c *errAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, nil, c.err
}

func (c *errAccessClient) BatchCheck(_ context.Context, _ authlib.AuthInfo, _ authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{}, c.err
}
