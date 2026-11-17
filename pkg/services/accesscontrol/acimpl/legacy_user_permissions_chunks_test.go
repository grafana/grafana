package acimpl

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
)

type chunkPermissionClient struct {
	legacyclient.Service
	response legacyclient.LegacyGetUserPermissionsChunksResponse
	err      error
}

func (c chunkPermissionClient) LegacyGetUserPermissionsChunks(context.Context, types.AuthInfo, legacyclient.LegacyGetUserPermissionsRequest) (legacyclient.LegacyGetUserPermissionsChunksResponse, error) {
	return c.response, c.err
}

func TestLoadLegacyUserPermissionsChunks(t *testing.T) {
	client := chunkPermissionClient{response: legacyclient.LegacyGetUserPermissionsChunksResponse{Chunks: [][]types.Permission{
		{{Action: "users:read", Scope: "users:*"}},
		{},
		{{Action: "dashboards:read", Scope: "dashboards:uid:one"}, {Action: "users:read", Scope: "users:*"}},
	}}}
	got, err := loadLegacyUserPermissions(t.Context(), client, legacyclient.LegacyGetUserPermissionsRequest{})
	require.NoError(t, err)
	require.Equal(t, []ac.Permission{
		{Action: "users:read", Scope: "users:*"},
		{Action: "dashboards:read", Scope: "dashboards:uid:one"},
		{Action: "users:read", Scope: "users:*"},
	}, got)
	require.Equal(t, len(got), cap(got))
	got[0].Action = "mutated"
	require.Equal(t, "users:read", client.response.Chunks[0][0].Action)

	client.err = errors.New("stream failed")
	got, err = loadLegacyUserPermissions(t.Context(), client, legacyclient.LegacyGetUserPermissionsRequest{})
	require.ErrorIs(t, err, client.err)
	require.Nil(t, got)

	got, err = loadLegacyUserPermissions(t.Context(), chunkPermissionClient{}, legacyclient.LegacyGetUserPermissionsRequest{})
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Empty(t, got)
}
