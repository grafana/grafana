package legacyclient

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

func TestLegacyCheckFailureDenies(t *testing.T) {
	tests := []struct {
		name        string
		response    *authzextv1.LegacyCheckResponse
		err         error
		wantAllowed bool
		wantError   bool
	}{
		{
			name:        "allowed",
			response:    &authzextv1.LegacyCheckResponse{Allowed: true},
			wantAllowed: true,
		},
		{
			name:     "denied",
			response: &authzextv1.LegacyCheckResponse{},
		},
		{
			name:      "response error overrides allowed",
			response:  &authzextv1.LegacyCheckResponse{Allowed: true, Error: "lookup failed"},
			wantError: true,
		},
		{
			name:      "transport error",
			err:       context.Canceled,
			wantError: true,
		},
		{
			name:      "missing response",
			wantError: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			client := &LegacyClient{
				clientV1: legacyCheckResponseClient{response: tc.response, err: tc.err},
				tracer:   noop.Tracer{},
			}

			allowed, err := client.LegacyCheck(t.Context(), LegacyCheckRequest{Evaluator: accesscontrol.EvalPermission("annotations:read")})
			if tc.wantError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}

			require.Equal(t, tc.wantAllowed, allowed)
		})
	}
}

func TestClient_LegacyCheckErrorCodes(t *testing.T) {
	for _, tc := range []struct {
		name     string
		response *authzextv1.LegacyCheckResponse
		rpcErr   error
		allowed  bool
		wantErr  bool
		notFound bool
	}{
		{
			name:     "allowed",
			response: &authzextv1.LegacyCheckResponse{Allowed: true},
			allowed:  true,
		},
		{
			name:     "denied",
			response: &authzextv1.LegacyCheckResponse{},
		},
		{
			name:    "transport error",
			rpcErr:  status.Error(codes.Unavailable, "offline"),
			wantErr: true,
		},
		{
			name:     "old server error text does not establish resource absence",
			response: &authzextv1.LegacyCheckResponse{Error: "annotation not found"},
			wantErr:  true,
		},
		{
			name: "resource not found",
			response: &authzextv1.LegacyCheckResponse{
				Error:     "could not resolve annotations:id:1: annotation not found",
				ErrorCode: authzextv1.LegacyCheckErrorCode_LEGACY_CHECK_ERROR_CODE_SCOPE_RESOURCE_NOT_FOUND,
			},
			wantErr:  true,
			notFound: true,
		},
		{
			name: "error code denies even without text and with allowed set",
			response: &authzextv1.LegacyCheckResponse{
				Allowed:   true,
				ErrorCode: authzextv1.LegacyCheckErrorCode_LEGACY_CHECK_ERROR_CODE_SCOPE_RESOURCE_NOT_FOUND,
			},
			wantErr:  true,
			notFound: true,
		},
		{
			name: "unknown error code denies",
			response: &authzextv1.LegacyCheckResponse{
				Allowed:   true,
				ErrorCode: authzextv1.LegacyCheckErrorCode(99),
			},
			wantErr: true,
		},
		{
			name:     "unclassified error overrides allowed",
			response: &authzextv1.LegacyCheckResponse{Allowed: true, Error: "lookup failed"},
			wantErr:  true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &LegacyClient{clientV1: legacyCheckResponseClient{response: tc.response, err: tc.rpcErr}, tracer: noop.Tracer{}}
			allowed, err := client.LegacyCheck(t.Context(), LegacyCheckRequest{Evaluator: accesscontrol.EvalPermission("annotations:read")})
			require.Equal(t, tc.allowed, allowed)
			if tc.wantErr {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
			if tc.notFound {
				require.ErrorIs(t, err, accesscontrol.ErrScopeResourceNotFound)
			} else {
				require.NotErrorIs(t, err, accesscontrol.ErrScopeResourceNotFound)
			}
			if tc.rpcErr != nil {
				require.ErrorIs(t, err, tc.rpcErr)
			}
		})
	}
}

type legacyCheckResponseClient struct {
	authzextv1.LegacyAuthzServiceClient
	response *authzextv1.LegacyCheckResponse
	err      error
}

func (c legacyCheckResponseClient) LegacyCheck(context.Context, *authzextv1.LegacyCheckRequest, ...grpc.CallOption) (*authzextv1.LegacyCheckResponse, error) {
	return c.response, c.err
}

func TestClient_LegacyCheckRequest(t *testing.T) {
	permission := func(action string, scopes ...string) *authzextv1.LegacyExpression {
		return &authzextv1.LegacyExpression{
			Node: &authzextv1.LegacyExpression_Permission{
				Permission: &authzextv1.LegacyPermission{Action: action, Scopes: scopes},
			},
		}
	}

	for _, tc := range []struct {
		name string
		req  LegacyCheckRequest
		want *authzextv1.LegacyCheckRequest
	}{
		{
			name: "internal profile with concrete namespace",
			req: LegacyCheckRequest{
				Namespace: "org-12", Evaluator: accesscontrol.EvalPermission("dashboards:create"),
				InternalIdentity: &LegacyInternalIdentity{Profile: "service"}, SkipScopeResolution: true,
			},
			want: &authzextv1.LegacyCheckRequest{
				Namespace: "org-12", Expression: permission("dashboards:create"),
				InternalIdentity: &authzextv1.LegacyInternalIdentity{Profile: "service"}, SkipScopeResolution: true,
			},
		},
		{
			name: "empty internal profile remains present for server validation",
			req: LegacyCheckRequest{
				Namespace: "org-12", Evaluator: accesscontrol.EvalPermission("dashboards:create"),
				InternalIdentity: &LegacyInternalIdentity{},
			},
			want: &authzextv1.LegacyCheckRequest{
				Namespace: "org-12", Expression: permission("dashboards:create"),
				InternalIdentity: &authzextv1.LegacyInternalIdentity{},
			},
		},
		{
			name: "nested expression and request options",
			req: LegacyCheckRequest{
				Namespace: "stacks-123", Subject: "user:checked-user", Teams: []string{"team-one"},
				SkipCache: true, SkipScopeResolution: true,
				Evaluator: accesscontrol.EvalAll(
					accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:one", "dashboards:uid:two"),
					accesscontrol.EvalAny(
						accesscontrol.EvalPermission("users:create"),
						accesscontrol.EvalPermission("users:write", ""),
					),
				),
			},
			want: &authzextv1.LegacyCheckRequest{
				Namespace: "stacks-123", Subject: "user:checked-user", Teams: []string{"team-one"},
				SkipCache: true, SkipScopeResolution: true,
				Expression: &authzextv1.LegacyExpression{
					Node: &authzextv1.LegacyExpression_All{All: &authzextv1.LegacyExpressionList{
						Expressions: []*authzextv1.LegacyExpression{
							permission("dashboards:read", "dashboards:uid:one", "dashboards:uid:two"),
							{Node: &authzextv1.LegacyExpression_Any{Any: &authzextv1.LegacyExpressionList{
								Expressions: []*authzextv1.LegacyExpression{permission("users:create"), permission("users:write", "")},
							}}},
						},
					}},
				},
			},
		},
		{
			name: "global evaluation preserves effective action restrictions",
			req: LegacyCheckRequest{
				Namespace: "default", Subject: "user:checked-user", Evaluator: accesscontrol.EvalPermission("users:read"),
				GlobalEvaluation: &LegacyGlobalEvaluation{RequesterOrgID: accesscontrol.GlobalOrgID, PermittedActions: []string{"users:read"}},
			},
			want: &authzextv1.LegacyCheckRequest{
				Namespace: "default", Subject: "user:checked-user", Expression: permission("users:read"),
				GlobalEvaluation: &authzextv1.LegacyGlobalEvaluation{RequesterOrgId: accesscontrol.GlobalOrgID, PermittedActions: []string{"users:read"}},
			},
		},
		{
			name: "empty global restrictions remain distinct from organization evaluation",
			req: LegacyCheckRequest{
				Namespace: "stacks-123", Subject: "user:checked-user", Evaluator: accesscontrol.EvalPermission("users:read"),
				GlobalEvaluation: &LegacyGlobalEvaluation{RequesterOrgID: accesscontrol.NoOrgID},
			},
			want: &authzextv1.LegacyCheckRequest{
				Namespace: "stacks-123", Subject: "user:checked-user", Expression: permission("users:read"),
				GlobalEvaluation: &authzextv1.LegacyGlobalEvaluation{RequesterOrgId: accesscontrol.NoOrgID},
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := &legacyCheckServer{}
			var client LegacyAccessClient = newLegacyTransportClient(t, server)

			allowed, err := client.LegacyCheck(t.Context(), tc.req)

			require.NoError(t, err)
			require.True(t, allowed)
			require.True(t, proto.Equal(tc.want, server.request), "want %v, got %v", tc.want, server.request)
		})
	}
}

func TestClient_LegacyCheckRejectsInvalidEvaluator(t *testing.T) {
	for _, tc := range []struct {
		name      string
		evaluator accesscontrol.Evaluator
		wantErr   string
	}{
		{name: "missing evaluator", wantErr: "legacy evaluator is required"},
		{name: "empty action", evaluator: accesscontrol.EvalPermission(""), wantErr: "legacy permission action is required"},
		{name: "custom evaluator", evaluator: unsupportedLegacyCheckEvaluator{}, wantErr: "unsupported legacy evaluator type"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := &legacyCheckServer{}
			client := newLegacyTransportClient(t, server)

			allowed, err := client.LegacyCheck(t.Context(), LegacyCheckRequest{Evaluator: tc.evaluator})

			require.False(t, allowed)
			require.ErrorContains(t, err, tc.wantErr)
			require.Nil(t, server.request)
		})
	}
}

func TestClient_LegacyCheckRequiresConfiguredClient(t *testing.T) {
	client := &LegacyClient{tracer: noop.Tracer{}}
	allowed, err := client.LegacyCheck(t.Context(), LegacyCheckRequest{Evaluator: accesscontrol.EvalPermission("users:read")})

	require.False(t, allowed)
	require.EqualError(t, err, "legacy check client is not configured")
}

type legacyCheckServer struct {
	authzextv1.UnimplementedLegacyAuthzServiceServer
	request *authzextv1.LegacyCheckRequest
}

func (s *legacyCheckServer) LegacyCheck(_ context.Context, req *authzextv1.LegacyCheckRequest) (*authzextv1.LegacyCheckResponse, error) {
	s.request = req
	return &authzextv1.LegacyCheckResponse{Allowed: true}, nil
}

type unsupportedLegacyCheckEvaluator struct {
	accesscontrol.Evaluator
}
