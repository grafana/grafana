package iam

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

// fakeAccessClient is a mock implementation of types.AccessClient for testing.
type fakeAccessClient struct {
	checkFunc func(ctx context.Context, id types.AuthInfo, req types.CheckRequest, folder string) (types.CheckResponse, error)
}

func (f *fakeAccessClient) Check(ctx context.Context, id types.AuthInfo, req types.CheckRequest, folder string) (types.CheckResponse, error) {
	if f.checkFunc != nil {
		return f.checkFunc(ctx, id, req, folder)
	}
	return types.CheckResponse{Allowed: false}, nil
}

func (f *fakeAccessClient) Compile(ctx context.Context, id types.AuthInfo, req types.ListRequest) (types.ItemChecker, types.Zookie, error) {
	return nil, types.NoopZookie{}, nil
}

func (f *fakeAccessClient) BatchCheck(ctx context.Context, id types.AuthInfo, req types.BatchCheckRequest) (types.BatchCheckResponse, error) {
	return types.BatchCheckResponse{}, nil
}

// authorizerScenario captures the per-resource configuration used to drive the shared test logic.
type authorizerScenario struct {
	name             string
	newAuthorizer    func(types.AccessClient) authorizer.Authorizer
	group            string
	resource         string
	resourceName     string
	subResources     []string // subresources that trigger the custom check
	deniedReason     string   // reason string returned when the custom check denies
	checkRequestVerb string   // verb expected in the CheckRequest built for the custom check
}

var authorizerScenarios = []authorizerScenario{
	{
		name:             "team",
		newAuthorizer:    newTeamAuthorizer,
		group:            iamv0.TeamResourceInfo.GroupResource().Group,
		resource:         iamv0.TeamResourceInfo.GroupResource().Resource,
		resourceName:     "team-abc",
		subResources:     []string{"members", "groups"},
		deniedReason:     "requires team getpermissions",
		checkRequestVerb: "get_permissions",
	},
	{
		name:             "user",
		newAuthorizer:    newUserAuthorizer,
		group:            iamv0.UserResourceInfo.GroupResource().Group,
		resource:         iamv0.UserResourceInfo.GroupResource().Resource,
		resourceName:     "user-xyz",
		subResources:     []string{"teams", "status"},
		deniedReason:     "requires user get",
		checkRequestVerb: "get", // shared tests use verb "get"; update verb tested separately
	},
	{
		name:             "serviceaccount",
		newAuthorizer:    newServiceAccountAuthorizer,
		group:            iamv0.ServiceAccountResourceInfo.GroupResource().Group,
		resource:         iamv0.ServiceAccountResourceInfo.GroupResource().Resource,
		resourceName:     "sa-abc",
		subResources:     []string{"tokens"},
		deniedReason:     "requires serviceaccount get",
		checkRequestVerb: "get",
	},
}

// newTestAuthInfo returns a minimal AuthInfo for use in authorization tests.
func newTestAuthInfo() types.AuthInfo {
	return authn.NewIDTokenAuthInfo(
		authn.Claims[authn.AccessTokenClaims]{},
		&authn.Claims[authn.IDTokenClaims]{},
	)
}

// TestAuthorizerCheckRequest verifies that each authorizer builds the correct
// CheckRequest when its custom subresources are accessed.
func TestAuthorizerCheckRequest(t *testing.T) {
	for _, sc := range authorizerScenarios {
		t.Run(sc.name, func(t *testing.T) {
			for _, sub := range sc.subResources {
				t.Run(sub, func(t *testing.T) {
					var capturedReq *types.CheckRequest
					fakeClient := &fakeAccessClient{
						checkFunc: func(_ context.Context, _ types.AuthInfo, req types.CheckRequest, _ string) (types.CheckResponse, error) {
							capturedReq = &req
							return types.CheckResponse{Allowed: true}, nil
						},
					}

					auth := sc.newAuthorizer(fakeClient)
					ctx := types.WithAuthInfo(context.Background(), newTestAuthInfo())

					attr := authorizer.AttributesRecord{
						ResourceRequest: true,
						APIGroup:        sc.group,
						Resource:        sc.resource,
						Subresource:     sub,
						Name:            sc.resourceName,
						Verb:            "get",
						Namespace:       "org-1",
					}

					_, _, err := auth.Authorize(ctx, attr)
					require.NoError(t, err)
					require.NotNil(t, capturedReq)

					assert.Equal(t, sc.checkRequestVerb, capturedReq.Verb)
					assert.Equal(t, sc.group, capturedReq.Group)
					assert.Equal(t, sc.resource, capturedReq.Resource)
					assert.Equal(t, sc.resourceName, capturedReq.Name)
					assert.Equal(t, "org-1", capturedReq.Namespace)
				})
			}
		})
	}
}

// TestAuthorizerDecisionMatrix covers all decision paths for each authorizer.
func TestAuthorizerDecisionMatrix(t *testing.T) {
	for _, sc := range authorizerScenarios {
		t.Run(sc.name, func(t *testing.T) {
			type testCase struct {
				name            string
				subresource     string
				resourceRequest bool
				checkFunc       func(ctx context.Context, id types.AuthInfo, req types.CheckRequest, folder string) (types.CheckResponse, error)
				wantDecision    authorizer.Decision
				wantReason      string
				wantErr         bool
				wantCheckCalled bool
			}

			var tests []testCase

			for _, sub := range sc.subResources {
				tests = append(tests, testCase{
					name:            sub + " subresource - allowed",
					subresource:     sub,
					resourceRequest: true,
					checkFunc: func(_ context.Context, _ types.AuthInfo, _ types.CheckRequest, _ string) (types.CheckResponse, error) {
						return types.CheckResponse{Allowed: true}, nil
					},
					wantDecision:    authorizer.DecisionAllow,
					wantCheckCalled: true,
				}, testCase{
					name:            sub + " subresource - denied",
					subresource:     sub,
					resourceRequest: true,
					checkFunc: func(_ context.Context, _ types.AuthInfo, _ types.CheckRequest, _ string) (types.CheckResponse, error) {
						return types.CheckResponse{Allowed: false}, nil
					},
					wantDecision:    authorizer.DecisionDeny,
					wantReason:      sc.deniedReason,
					wantCheckCalled: true,
				}, testCase{
					name:            sub + " subresource - error",
					subresource:     sub,
					resourceRequest: true,
					checkFunc: func(_ context.Context, _ types.AuthInfo, _ types.CheckRequest, _ string) (types.CheckResponse, error) {
						return types.CheckResponse{}, errors.New("database error")
					},
					wantDecision:    authorizer.DecisionDeny,
					wantErr:         true,
					wantCheckCalled: true,
				})
			}

			tests = append(tests, testCase{
				name:            "no subresource - delegates to ResourceAuthorizer",
				subresource:     "",
				resourceRequest: true,
				checkFunc: func(_ context.Context, _ types.AuthInfo, _ types.CheckRequest, _ string) (types.CheckResponse, error) {
					return types.CheckResponse{Allowed: true}, nil
				},
				wantDecision:    authorizer.DecisionAllow,
				wantCheckCalled: true,
			}, testCase{
				name:            "not specified subresource ( unknown ) - denied",
				subresource:     "unknown",
				resourceRequest: true,
				wantDecision:    authorizer.DecisionDeny,
				wantErr:         true,
			}, testCase{
				name:            "non-resource request - no opinion",
				resourceRequest: false,
				wantDecision:    authorizer.DecisionNoOpinion,
			})

			for _, tt := range tests {
				t.Run(tt.name, func(t *testing.T) {
					checkCalled := false
					wrappedCheck := func(ctx context.Context, id types.AuthInfo, req types.CheckRequest, folder string) (types.CheckResponse, error) {
						checkCalled = true
						if tt.checkFunc != nil {
							return tt.checkFunc(ctx, id, req, folder)
						}
						return types.CheckResponse{Allowed: false}, nil
					}

					auth := sc.newAuthorizer(&fakeAccessClient{checkFunc: wrappedCheck})
					ctx := types.WithAuthInfo(context.Background(), newTestAuthInfo())

					attr := authorizer.AttributesRecord{
						ResourceRequest: tt.resourceRequest,
						APIGroup:        sc.group,
						Resource:        sc.resource,
						Subresource:     tt.subresource,
						Name:            sc.resourceName,
						Verb:            "get",
					}

					decision, reason, err := auth.Authorize(ctx, attr)

					if tt.wantErr {
						require.Error(t, err)
					} else {
						require.NoError(t, err)
					}
					assert.Equal(t, tt.wantDecision, decision)
					assert.Equal(t, tt.wantReason, reason)
					assert.Equal(t, tt.wantCheckCalled, checkCalled, "Check call mismatch")
				})
			}
		})
	}
}

// TestUserAuthorizerStatusVerbMapping verifies that the user/status subresource
// maps request verbs to the correct RBAC check verbs (GET→get, UPDATE→update, PATCH→update).
func TestUserAuthorizerStatusVerbMapping(t *testing.T) {
	tests := []struct {
		name             string
		requestVerb      string
		wantCheckVerb    string
		wantDeniedReason string
	}{
		{name: "get maps to get", requestVerb: "get", wantCheckVerb: "get", wantDeniedReason: "requires user get"},
		{name: "update maps to update", requestVerb: "update", wantCheckVerb: "update", wantDeniedReason: "requires user update"},
		{name: "patch maps to update", requestVerb: "patch", wantCheckVerb: "update", wantDeniedReason: "requires user update"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var capturedReq *types.CheckRequest
			fakeClient := &fakeAccessClient{
				checkFunc: func(_ context.Context, _ types.AuthInfo, req types.CheckRequest, _ string) (types.CheckResponse, error) {
					capturedReq = &req
					return types.CheckResponse{Allowed: false}, nil
				},
			}

			auth := newUserAuthorizer(fakeClient)
			ctx := types.WithAuthInfo(context.Background(), newTestAuthInfo())

			attr := authorizer.AttributesRecord{
				ResourceRequest: true,
				APIGroup:        iamv0.UserResourceInfo.GroupResource().Group,
				Resource:        iamv0.UserResourceInfo.GroupResource().Resource,
				Subresource:     "status",
				Name:            "user-xyz",
				Verb:            tt.requestVerb,
				Namespace:       "org-1",
			}

			decision, reason, _ := auth.Authorize(ctx, attr)

			require.NotNil(t, capturedReq)
			assert.Equal(t, tt.wantCheckVerb, capturedReq.Verb)
			assert.Equal(t, authorizer.DecisionDeny, decision)
			assert.Equal(t, tt.wantDeniedReason, reason)
		})
	}
}
