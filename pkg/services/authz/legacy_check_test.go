package authz

import (
	"context"
	"testing"

	legacyv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type legacyCheckRPC struct {
	legacyv1.LegacyAuthzServiceClient
	response *legacyv1.LegacyCheckResponse
	err      error
}

func (c *legacyCheckRPC) LegacyCheck(context.Context, *legacyv1.LegacyCheckRequest, ...grpc.CallOption) (*legacyv1.LegacyCheckResponse, error) {
	return c.response, c.err
}

func TestLegacyCheckResponseHandling(t *testing.T) {
	for _, tc := range []struct {
		name        string
		response    *legacyv1.LegacyCheckResponse
		err         error
		wantAllowed bool
		wantError   string
	}{
		{name: "allow", response: &legacyv1.LegacyCheckResponse{Allowed: true}, wantAllowed: true},
		{name: "denial", response: &legacyv1.LegacyCheckResponse{}},
		{name: "evaluation error overrides allow", response: &legacyv1.LegacyCheckResponse{Allowed: true, Error: "permission store unavailable"}, wantError: "permission store unavailable"},
		{name: "unavailable", err: status.Error(codes.Unavailable, "offline")},
		{name: "old server", err: status.Error(codes.Unimplemented, "LegacyCheck")},
		{name: "cancelled", err: context.Canceled},
		{name: "empty response"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			allowed, err := LegacyCheck(t.Context(), &legacyCheckRPC{response: tc.response, err: tc.err}, &legacyv1.LegacyCheckRequest{})
			require.Equal(t, tc.wantAllowed, allowed)
			switch {
			case tc.err != nil:
				require.ErrorIs(t, err, tc.err)
			case tc.wantError != "":
				require.EqualError(t, err, tc.wantError)
			default:
				require.NoError(t, err)
			}
		})
	}
}

func TestLegacyCheckMissingClient(t *testing.T) {
	allowed, err := LegacyCheck(t.Context(), nil, &legacyv1.LegacyCheckRequest{})
	require.EqualError(t, err, "legacy check client is not configured")
	require.False(t, allowed)
}
