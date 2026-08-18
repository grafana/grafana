package acimpl

import (
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type invalidationRecordingUserPermissionsClient struct {
	accesscontrol.UserPermissionsClient
	user identity.Requester
}

func (c *invalidationRecordingUserPermissionsClient) ClearUserPermissionCache(user identity.Requester) {
	c.user = user
}

func TestServiceClearUserPermissionCacheInvalidatesAuthZCache(t *testing.T) {
	service := setupTestEnv(t, false)
	client := &invalidationRecordingUserPermissionsClient{}
	service.SetUserPermissionsClient(client)
	user := &identity.StaticRequester{Type: types.TypeUser, UserID: 1, UserUID: "user-uid", OrgID: 2}

	service.ClearUserPermissionCache(user)

	require.Equal(t, user, client.user)
}
