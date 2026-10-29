package legacyclient

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"

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
