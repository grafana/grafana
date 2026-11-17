package acimpl

import (
	"context"
	"errors"
	"testing"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestEvaluateLegacyCheckRouting(t *testing.T) {
	for _, tc := range []struct {
		name             string
		enabled          bool
		withoutResolvers bool
		missingClient    bool
		withoutGrants    bool
		response         *authzextv1.LegacyCheckResponse
		rpcError         error
		allowed          bool
		wantError        string
		wantErrorIs      error
		calls            int
	}{
		{
			name:          "disabled uses local permissions without a client",
			missingClient: true,
			allowed:       true,
		},
		{
			name:     "enabled uses RPC denial despite local grant",
			enabled:  true,
			response: &authzextv1.LegacyCheckResponse{Allowed: false},
			calls:    1,
		},
		{
			name:          "enabled loads grants through RPC",
			enabled:       true,
			withoutGrants: true,
			response:      &authzextv1.LegacyCheckResponse{Allowed: true},
			allowed:       true,
			calls:         1,
		},
		{
			name:             "without resolvers retains RPC routing",
			enabled:          true,
			withoutResolvers: true,
			response:         &authzextv1.LegacyCheckResponse{Allowed: true},
			allowed:          true,
			calls:            1,
		},
		{
			name:      "evaluation error denies without local fallback",
			enabled:   true,
			response:  &authzextv1.LegacyCheckResponse{Allowed: true, Error: "evaluation failed"},
			wantError: "evaluation failed",
			calls:     1,
		},
		{
			name:      "transport error denies without local fallback",
			enabled:   true,
			rpcError:  errors.New("transport failed"),
			wantError: "transport failed",
			calls:     1,
		},
		{
			name:    "resource absence preserves the typed error",
			enabled: true,
			response: &authzextv1.LegacyCheckResponse{
				Error:     "resource not found",
				ErrorCode: authzextv1.LegacyCheckErrorCode_LEGACY_CHECK_ERROR_CODE_SCOPE_RESOURCE_NOT_FOUND,
			},
			wantErrorIs: accesscontrol.ErrScopeResourceNotFound,
			calls:       1,
		},
		{
			name:          "missing client denies",
			enabled:       true,
			missingClient: true,
			wantError:     "legacy check client is not configured",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
				featuremgmt.FlagAuthzUseLegacyCheck: {
					State:          memprovider.Enabled,
					Variants:       map[string]any{"value": tc.enabled},
					DefaultVariant: "value",
				},
			})))
			t.Cleanup(func() {
				require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{}))
			})

			backend := &legacyCheckRoutingServer{response: tc.response, err: tc.rpcError}
			channel := &inprocgrpc.Channel{}
			authzextv1.RegisterLegacyAuthzServiceServer(channel, backend)
			ac := ProvideAccessControlTest()
			if !tc.missingClient {
				ac.SetLegacyCheckClient(legacyclient.NewLegacyClient(channel), false, types.OrgNamespaceFormatter)
			}
			var evaluator accesscontrol.AccessControl = ac
			if tc.withoutResolvers {
				evaluator = ac.WithoutResolvers()
			}

			requester := &user.SignedInUser{
				UserID:      1,
				UserUID:     "user-uid",
				OrgID:       1,
				Permissions: map[int64]map[string][]string{1: {"dashboards:read": {"dashboards:uid:one"}}},
			}
			if tc.withoutGrants {
				requester.Permissions = nil
			}

			allowed, err := evaluator.Evaluate(t.Context(), requester, accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:one"))
			require.Equal(t, tc.allowed, allowed)
			switch {
			case tc.wantErrorIs != nil:
				require.ErrorIs(t, err, tc.wantErrorIs)
			case tc.wantError != "":
				require.ErrorContains(t, err, tc.wantError)
			default:
				require.NoError(t, err)
			}
			require.Len(t, backend.requests, tc.calls)
			if tc.calls > 0 {
				request := backend.requests[0]
				require.Equal(t, "default", request.GetNamespace())
				require.Equal(t, "user:user-uid", request.GetSubject())
				require.Equal(t, "dashboards:read", request.GetExpression().GetPermission().GetAction())
				require.Equal(t, []string{"dashboards:uid:one"}, request.GetExpression().GetPermission().GetScopes())
				require.Equal(t, tc.withoutResolvers, request.GetSkipScopeResolution())
			}
		})
	}
}

type legacyCheckRoutingServer struct {
	authzextv1.UnimplementedLegacyAuthzServiceServer
	response *authzextv1.LegacyCheckResponse
	err      error
	requests []*authzextv1.LegacyCheckRequest
}

func (s *legacyCheckRoutingServer) LegacyCheck(_ context.Context, req *authzextv1.LegacyCheckRequest) (*authzextv1.LegacyCheckResponse, error) {
	s.requests = append(s.requests, req)
	return s.response, s.err
}
