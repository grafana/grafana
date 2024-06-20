package grpc

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestBasicEncodeDecode(t *testing.T) {
	before := &identity.StaticRequester{
		UserID:    123,
		UserUID:   "abc",
		Login:     "test",
		Namespace: identity.NamespaceUser,
		OrgID:     456,
		OrgName:   "org",
		OrgRole:   identity.RoleAdmin,
	}

	auth := &Authenticator{}

	md := encodeIdentityInMetadata(before)
	after, err := auth.DecodeMetadata(context.Background(), md)
	require.NoError(t, err)
	require.Equal(t, before.GetID(), after.GetID())
	require.Equal(t, before.GetUID(), after.GetUID())
	require.Equal(t, before.GetLogin(), after.GetLogin())
	require.Equal(t, before.GetOrgID(), after.GetOrgID())
	require.Equal(t, before.GetOrgName(), after.GetOrgName())
	require.Equal(t, before.GetOrgRole(), after.GetOrgRole())
}
