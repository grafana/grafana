package legacyclient

import (
	"context"
	"io"
	"testing"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	authzv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

func legacyCaller(namespace string, permissions ...string) *authn.AuthInfo {
	return authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: "access-policy:embedded-grafana"},
		Rest:   authn.AccessTokenClaims{Namespace: namespace, Permissions: permissions},
	})
}

func legacyRequest() LegacyGetUserPermissionsRequest {
	id := int64(7)
	return LegacyGetUserPermissionsRequest{
		Namespace: "stacks-12",
		Identity: LegacyPermissionIdentity{
			Type: types.TypeUser, UID: "8", InternalID: &id, HasUniqueID: true,
			OrgRole: "Viewer", IsGrafanaAdmin: true, TeamIDs: []int64{10, 11}, Groups: []string{"target-group"},
		},
	}
}

func TestClient_LegacyGetUserPermissionsCompleteSnapshot(t *testing.T) {
	rpc := &legacyTestRPC{responses: []*authzv1.LegacyGetUserPermissionsResponse{
		{Permissions: []*authzv1.LegacyPermission{{Action: "users:create"}}},
		{Permissions: []*authzv1.LegacyPermission{{Action: "users:create"}, {Action: "dashboards:read", Scope: "*"}}},
	}}
	client := &LegacyClient{clientV1: rpc, tracer: noop.Tracer{}}
	req := legacyRequest()
	caller := legacyCaller("stacks-12", "authz.grafana.app/legacyuserpermissions:get")
	for _, flags := range []struct{ reload, skip bool }{{false, false}, {true, false}, {false, true}, {true, true}} {
		req.ReloadCache, req.SkipZanzanaCache = flags.reload, flags.skip
		got, err := client.LegacyGetUserPermissions(t.Context(), caller, req)
		require.NoError(t, err)
		require.Equal(t, []types.Permission{
			{Action: "users:create"}, {Action: "users:create"}, {Action: "dashboards:read", Scope: "*"},
		}, got.Permissions)
		require.Equal(t, &authzv1.LegacyGetUserPermissionsRequest{
			Namespace: "stacks-12",
			Identity: &authzv1.LegacyPermissionIdentity{
				Type: "user", Uid: "8", InternalId: req.Identity.InternalID, HasUniqueId: true,
				OrgRole: "Viewer", IsGrafanaAdmin: true, TeamIds: []int64{10, 11}, Groups: []string{"target-group"},
			},
			ReloadCache: flags.reload, SkipZanzanaCache: flags.skip,
		}, rpc.request)
	}
	require.Equal(t, 4, rpc.calls, "every invocation must reach the transport")
}

func TestClient_LegacyGetUserPermissionsStreamFailures(t *testing.T) {
	for _, tc := range []struct {
		name             string
		responses        []*authzv1.LegacyGetUserPermissionsResponse
		openErr, recvErr error
		wantError        bool
	}{
		{name: "empty stream"},
		{name: "empty chunk", responses: []*authzv1.LegacyGetUserPermissionsResponse{{}}},
		{name: "nil chunk", responses: []*authzv1.LegacyGetUserPermissionsResponse{nil}, wantError: true},
		{name: "nil permission", responses: []*authzv1.LegacyGetUserPermissionsResponse{{Permissions: []*authzv1.LegacyPermission{nil}}}, wantError: true},
		{name: "unsupported server", openErr: status.Error(codes.Unimplemented, "old server"), wantError: true},
		{name: "failure after chunk", responses: []*authzv1.LegacyGetUserPermissionsResponse{{Permissions: []*authzv1.LegacyPermission{{Action: "users:create"}}}}, recvErr: status.Error(codes.Unavailable, "interrupted"), wantError: true},
		{name: "canceled", recvErr: context.Canceled, wantError: true},
		{name: "deadline", recvErr: context.DeadlineExceeded, wantError: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rpc := &legacyTestRPC{responses: tc.responses, openErr: tc.openErr, recvErr: tc.recvErr}
			client := &LegacyClient{clientV1: rpc, tracer: noop.Tracer{}}
			got, err := client.LegacyGetUserPermissions(t.Context(), legacyCaller("stacks-12", "authz.grafana.app/legacyuserpermissions:get"), legacyRequest())
			if tc.wantError {
				require.Error(t, err)
				if tc.openErr != nil {
					require.ErrorIs(t, err, tc.openErr)
				}
				if tc.recvErr != nil {
					require.ErrorIs(t, err, tc.recvErr)
				}
			} else {
				require.NoError(t, err)
			}
			require.Empty(t, got.Permissions)
		})
	}
}

type legacyTestRPC struct {
	authzv1.LegacyAuthzServiceClient
	request          *authzv1.LegacyGetUserPermissionsRequest
	responses        []*authzv1.LegacyGetUserPermissionsResponse
	openErr, recvErr error
	calls            int
}

func (f *legacyTestRPC) LegacyGetUserPermissions(_ context.Context, req *authzv1.LegacyGetUserPermissionsRequest, _ ...grpc.CallOption) (authzv1.LegacyAuthzService_LegacyGetUserPermissionsClient, error) {
	f.request = req
	f.calls++
	if f.openErr != nil {
		return nil, f.openErr
	}
	return &legacyTestStream{responses: append([]*authzv1.LegacyGetUserPermissionsResponse{}, f.responses...), err: f.recvErr}, nil
}

type legacyTestStream struct {
	grpc.ClientStream
	responses []*authzv1.LegacyGetUserPermissionsResponse
	err       error
}

func (s *legacyTestStream) Recv() (*authzv1.LegacyGetUserPermissionsResponse, error) {
	if len(s.responses) > 0 {
		r := s.responses[0]
		s.responses = s.responses[1:]
		return r, nil
	}
	if s.err != nil {
		return nil, s.err
	}
	return nil, io.EOF
}
