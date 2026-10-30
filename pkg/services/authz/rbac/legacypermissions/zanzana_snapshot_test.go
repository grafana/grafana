package legacypermissions

import (
	"context"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

type snapshotZanzanaClient struct {
	capturingZanzanaClient
	response types.GetUserPermissionsResponse
	err      error
	info     types.AuthInfo
}

func (c *snapshotZanzanaClient) GetUserPermissions(_ context.Context, info types.AuthInfo, _ types.GetUserPermissionsRequest) (types.GetUserPermissionsResponse, error) {
	c.info = info
	return c.response, c.err
}
func (*snapshotZanzanaClient) InvalidateUserPermissions(context.Context, types.AuthInfo, types.GetUserPermissionsRequest) error {
	return nil
}

func TestResolveCurrentUserPermissionsSnapshot(t *testing.T) {
	requester := &identity.StaticRequester{Type: types.TypeUser, UserUID: "alice", OrgID: 1, Namespace: "stacks-42", Groups: []string{"stored"}, ExternalGroups: []string{"external"}}
	client := &snapshotZanzanaClient{response: types.GetUserPermissionsResponse{Permissions: []types.Permission{{Action: "teams:read", Scope: "teams:id:42"}}}}
	resolver := NewZanzanaPermissionResolver(client, nil, nil, true)
	result, err := resolver.ResolveCurrentUserPermissions(t.Context(), requester, false)
	require.NoError(t, err)
	require.Equal(t, []ac.Permission{{Action: "teams:read", Scope: "teams:id:42"}}, result)
	require.Empty(t, client.listCalls)
	require.Equal(t, "stacks-42", client.info.GetNamespace())
	require.Equal(t, "user:alice", client.info.GetUID())
	require.Equal(t, []string{"external"}, client.info.GetGroups())
	require.Equal(t, []string{"authz.grafana.app/userpermissions:get"}, client.info.GetTokenDelegatedPermissions())
}

func TestResolveCurrentUserPermissionsSnapshotDoesNotFallback(t *testing.T) {
	for _, code := range []codes.Code{codes.Unimplemented, codes.Unavailable, codes.PermissionDenied, codes.Canceled, codes.DeadlineExceeded} {
		t.Run(code.String(), func(t *testing.T) {
			client := &snapshotZanzanaClient{err: status.Error(code, "snapshot error")}
			client.listResp = &authzv1.ListResponse{}
			resolver := NewZanzanaPermissionResolver(client, nil, nil, false)
			requester := &identity.StaticRequester{Type: types.TypeUser, UserUID: "alice", OrgID: 1}
			result, err := resolver.ResolveCurrentUserPermissions(t.Context(), requester, false)
			require.Equal(t, code, status.Code(err))
			require.Nil(t, result)
			require.Empty(t, client.listCalls, "current-user enumeration must never retry through List")
		})
	}
}
