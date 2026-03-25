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

// fakeAccessClient is a mock implementation of types.AccessClient for testing
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

// TestNewTeamAuthorizer_MembersSubresource_CheckRequest verifies that the authorizer
// builds the correct CheckRequest for the members subresource.
func TestNewTeamAuthorizer_MembersSubresource_CheckRequest(t *testing.T) {
	var capturedReq *types.CheckRequest
	fakeClient := &fakeAccessClient{
		checkFunc: func(ctx context.Context, id types.AuthInfo, req types.CheckRequest, folder string) (types.CheckResponse, error) {
			capturedReq = &req
			return types.CheckResponse{Allowed: true}, nil
		},
	}

	teamAuth := newTeamAuthorizer(fakeClient)

	authInfo := authn.NewIDTokenAuthInfo(
		authn.Claims[authn.AccessTokenClaims]{},
		&authn.Claims[authn.IDTokenClaims]{},
	)
	ctx := types.WithAuthInfo(context.Background(), authInfo)

	attr := authorizer.AttributesRecord{
		ResourceRequest: true,
		APIGroup:        iamv0.TeamResourceInfo.GroupResource().Group,
		Resource:        iamv0.TeamResourceInfo.GroupResource().Resource,
		Subresource:     "members",
		Name:            "team-abc",
		Verb:            "get",
		Namespace:       "org-1",
	}

	_, _, err := teamAuth.Authorize(ctx, attr)
	require.NoError(t, err)
	require.NotNil(t, capturedReq)

	assert.Equal(t, "get_permissions", capturedReq.Verb)
	assert.Equal(t, iamv0.TeamResourceInfo.GroupResource().Group, capturedReq.Group)
	assert.Equal(t, iamv0.TeamResourceInfo.GroupResource().Resource, capturedReq.Resource)
	assert.Equal(t, "team-abc", capturedReq.Name)
	assert.Equal(t, "org-1", capturedReq.Namespace)
}

// TestNewTeamAuthorizer_DecisionMatrix covers all decision paths with table-driven tests.
func TestNewTeamAuthorizer_DecisionMatrix(t *testing.T) {
	tests := []struct {
		name            string
		subresource     string
		resourceRequest bool
		checkFunc       func(ctx context.Context, id types.AuthInfo, req types.CheckRequest, folder string) (types.CheckResponse, error)
		wantDecision    authorizer.Decision
		wantReason      string
		wantErr         bool
		wantCheckCalled bool
	}{
		{
			name:            "members subresource - allowed",
			subresource:     "members",
			resourceRequest: true,
			checkFunc: func(ctx context.Context, id types.AuthInfo, req types.CheckRequest, folder string) (types.CheckResponse, error) {
				return types.CheckResponse{Allowed: true}, nil
			},
			wantDecision:    authorizer.DecisionAllow,
			wantReason:      "",
			wantErr:         false,
			wantCheckCalled: true,
		},
		{
			name:            "members subresource - denied",
			subresource:     "members",
			resourceRequest: true,
			checkFunc: func(ctx context.Context, id types.AuthInfo, req types.CheckRequest, folder string) (types.CheckResponse, error) {
				return types.CheckResponse{Allowed: false}, nil
			},
			wantDecision:    authorizer.DecisionDeny,
			wantReason:      "requires team getpermissions",
			wantErr:         false,
			wantCheckCalled: true,
		},
		{
			name:            "members subresource - error",
			subresource:     "members",
			resourceRequest: true,
			checkFunc: func(ctx context.Context, id types.AuthInfo, req types.CheckRequest, folder string) (types.CheckResponse, error) {
				return types.CheckResponse{}, errors.New("database error")
			},
			wantDecision:    authorizer.DecisionDeny,
			wantReason:      "",
			wantErr:         true,
			wantCheckCalled: true,
		},
		{
			name:            "no subresource - delegates to ResourceAuthorizer",
			subresource:     "",
			resourceRequest: true,
			checkFunc: func(ctx context.Context, id types.AuthInfo, req types.CheckRequest, folder string) (types.CheckResponse, error) {
				// Verify the subresource is NOT passed through to the delegate
				assert.Empty(t, req.Subresource)
				return types.CheckResponse{Allowed: true}, nil
			},
			wantDecision:    authorizer.DecisionAllow,
			wantReason:      "",
			wantErr:         false,
			wantCheckCalled: true,
		},
		{
			name:            "other subresource (groups) - delegates to ResourceAuthorizer",
			subresource:     "groups",
			resourceRequest: true,
			checkFunc: func(ctx context.Context, id types.AuthInfo, req types.CheckRequest, folder string) (types.CheckResponse, error) {
				// The subresource should be passed through to the delegate
				assert.Equal(t, "groups", req.Subresource)
				return types.CheckResponse{Allowed: true}, nil
			},
			wantDecision:    authorizer.DecisionAllow,
			wantReason:      "",
			wantErr:         false,
			wantCheckCalled: true,
		},
		{
			name:            "non-resource request - no opinion",
			subresource:     "",
			resourceRequest: false,
			checkFunc:       nil, // Should not be called
			wantDecision:    authorizer.DecisionNoOpinion,
			wantReason:      "",
			wantErr:         false,
			wantCheckCalled: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			checkCalled := false
			wrappedCheckFunc := func(ctx context.Context, id types.AuthInfo, req types.CheckRequest, folder string) (types.CheckResponse, error) {
				checkCalled = true
				if tt.checkFunc != nil {
					return tt.checkFunc(ctx, id, req, folder)
				}
				return types.CheckResponse{Allowed: false}, nil
			}

			fakeClient := &fakeAccessClient{checkFunc: wrappedCheckFunc}
			teamAuth := newTeamAuthorizer(fakeClient)

			authInfo := authn.NewIDTokenAuthInfo(
				authn.Claims[authn.AccessTokenClaims]{},
				&authn.Claims[authn.IDTokenClaims]{},
			)
			ctx := types.WithAuthInfo(context.Background(), authInfo)

			attr := authorizer.AttributesRecord{
				ResourceRequest: tt.resourceRequest,
				APIGroup:        iamv0.TeamResourceInfo.GroupResource().Group,
				Resource:        iamv0.TeamResourceInfo.GroupResource().Resource,
				Subresource:     tt.subresource,
				Name:            "team-abc",
				Verb:            "get",
			}

			decision, reason, err := teamAuth.Authorize(ctx, attr)

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
}
