package grpc

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
)

func TestBasicEncodeDecode(t *testing.T) {
	before := &identity.StaticRequester{
		UserID:  123,
		UserUID: "abc",
		Login:   "test",
		Type:    claims.TypeUser,
		OrgID:   456,
		OrgRole: identity.RoleAdmin,
	}

	auth := &Authenticator{}

	md := encodeIdentityInMetadata(before)
	after, err := auth.decodeMetadata(context.Background(), md)
	require.NoError(t, err)
	require.Equal(t, before.GetID(), after.GetID())
	require.Equal(t, before.GetUID(), after.GetUID())
	require.Equal(t, before.GetIdentityType(), after.GetIdentityType())
	require.Equal(t, before.GetLogin(), after.GetLogin())
	require.Equal(t, before.GetOrgID(), after.GetOrgID())
	require.Equal(t, before.GetOrgName(), after.GetOrgName())
	require.Equal(t, before.GetOrgRole(), after.GetOrgRole())
}

func TestRenderEncodeDecode(t *testing.T) {
	before := &authn.Identity{
		ID:              "0",
		Type:            claims.TypeRenderService,
		OrgID:           1,
		OrgRoles:        map[int64]org.RoleType{1: identity.RoleEditor},
		ClientParams:    authn.ClientParams{SyncPermissions: true},
		LastSeenAt:      time.Now(),
		AuthenticatedBy: login.RenderModule,
	}

	auth := &Authenticator{}

	md := encodeIdentityInMetadata(before)
	after, err := auth.decodeMetadata(context.Background(), md)
	require.NoError(t, err)
	require.Equal(t, before.GetID(), after.GetID())
	require.Equal(t, before.GetUID(), after.GetUID())
	require.Equal(t, before.GetIdentityType(), after.GetIdentityType())
	require.Equal(t, before.GetLogin(), after.GetLogin())
	require.Equal(t, before.GetOrgID(), after.GetOrgID())
	require.Equal(t, before.GetOrgName(), after.GetOrgName())
	require.Equal(t, before.GetOrgRole(), after.GetOrgRole())
}
