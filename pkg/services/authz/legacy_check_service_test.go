package authz

import (
	"context"
	"testing"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	legacyv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestLegacyCheckRegistrationDoesNotExposeEnumeration(t *testing.T) {
	channel := &inprocgrpc.Channel{}
	channel.WithServerUnaryInterceptor(func(ctx context.Context, req any, info *grpc.UnaryServerInfo, next grpc.UnaryHandler) (any, error) {
		return next(types.WithAuthInfo(ctx, &identity.StaticRequester{Type: types.TypeAccessPolicy, UserUID: "iam", Namespace: "default"}), req)
	})
	server := rbac.NewTestService("subject", []accesscontrol.Permission{{Action: "ldap:read"}}, nil)
	registerLegacyCheckService(channel, server)
	client := legacyv1.NewLegacyAuthzServiceClient(channel)
	allowed, err := LegacyCheck(t.Context(), client, &legacyv1.LegacyCheckRequest{Namespace: "default", Subject: "user:subject", Expression: &legacyv1.LegacyExpression{Node: &legacyv1.LegacyExpression_Permission{Permission: &legacyv1.LegacyPermission{Action: "ldap:read"}}}})
	require.NoError(t, err)
	require.True(t, allowed)
	//nolint:staticcheck // Intentionally call the deprecated RPC to verify check-only registration rejects enumeration.
	stream, err := client.LegacyGetUserPermissions(t.Context(), &legacyv1.LegacyGetUserPermissionsRequest{})
	if err == nil {
		_, err = stream.Recv()
	}
	require.Equal(t, codes.Unimplemented, status.Code(err))
}
