package legacyclient

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

type legacyCheckTestRPC struct {
	authzv1.LegacyAuthzServiceClient
	response *authzv1.LegacyCheckResponse
	err      error
}

func (r legacyCheckTestRPC) LegacyCheck(context.Context, *authzv1.LegacyCheckRequest, ...grpc.CallOption) (*authzv1.LegacyCheckResponse, error) {
	return r.response, r.err
}

func TestLegacyCheckFailureDenies(t *testing.T) {
	tests := []struct {
		name        string
		response    *authzv1.LegacyCheckResponse
		err         error
		wantAllowed bool
		wantError   bool
	}{
		{
			name:        "allowed",
			response:    &authzv1.LegacyCheckResponse{Allowed: true},
			wantAllowed: true,
		},
		{
			name:     "denied",
			response: &authzv1.LegacyCheckResponse{},
		},
		{
			name:      "response error overrides allowed",
			response:  &authzv1.LegacyCheckResponse{Allowed: true, Error: "lookup failed"},
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
				clientV1: legacyCheckTestRPC{response: tc.response, err: tc.err},
				tracer:   noop.Tracer{},
			}

			allowed, err := client.LegacyCheck(t.Context(), &authzv1.LegacyCheckRequest{})
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
		response *authzv1.LegacyCheckResponse
		allowed  bool
		wantErr  bool
		notFound bool
	}{
		{
			name:     "allowed",
			response: &authzv1.LegacyCheckResponse{Allowed: true},
			allowed:  true,
		},
		{
			name:     "denied",
			response: &authzv1.LegacyCheckResponse{},
		},
		{
			name:     "old server error text does not establish resource absence",
			response: &authzv1.LegacyCheckResponse{Error: "annotation not found"},
			wantErr:  true,
		},
		{
			name: "resource not found",
			response: &authzv1.LegacyCheckResponse{
				Error:     "could not resolve annotations:id:1: annotation not found",
				ErrorCode: authzv1.LegacyCheckErrorCode_LEGACY_CHECK_ERROR_CODE_SCOPE_RESOURCE_NOT_FOUND,
			},
			wantErr:  true,
			notFound: true,
		},
		{
			name: "error code denies even without text and with allowed set",
			response: &authzv1.LegacyCheckResponse{
				Allowed:   true,
				ErrorCode: authzv1.LegacyCheckErrorCode_LEGACY_CHECK_ERROR_CODE_SCOPE_RESOURCE_NOT_FOUND,
			},
			wantErr:  true,
			notFound: true,
		},
		{
			name: "unknown error code denies",
			response: &authzv1.LegacyCheckResponse{
				Allowed:   true,
				ErrorCode: authzv1.LegacyCheckErrorCode(99),
			},
			wantErr: true,
		},
		{
			name:     "unclassified error overrides allowed",
			response: &authzv1.LegacyCheckResponse{Allowed: true, Error: "lookup failed"},
			wantErr:  true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := &LegacyClient{clientV1: legacyCheckTestRPC{response: tc.response}, tracer: noop.Tracer{}}
			allowed, err := client.LegacyCheck(t.Context(), &authzv1.LegacyCheckRequest{})
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
