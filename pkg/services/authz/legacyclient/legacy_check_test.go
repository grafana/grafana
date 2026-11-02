package legacyclient

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

func TestClient_LegacyCheckErrorCodes(t *testing.T) {
	for _, tc := range []struct {
		name     string
		response *authzextv1.LegacyCheckResponse
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
			client := &LegacyClient{clientV1: legacyCheckResponseClient{response: tc.response}, tracer: noop.Tracer{}}
			allowed, err := client.LegacyCheck(t.Context(), &authzextv1.LegacyCheckRequest{})
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
		})
	}
}

type legacyCheckResponseClient struct {
	authzextv1.LegacyAuthzServiceClient
	response *authzextv1.LegacyCheckResponse
}

func (c legacyCheckResponseClient) LegacyCheck(context.Context, *authzextv1.LegacyCheckRequest, ...grpc.CallOption) (*authzextv1.LegacyCheckResponse, error) {
	return c.response, nil
}
