package grpc

import (
	"testing"

	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"go.opentelemetry.io/otel/trace/noop"
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

	auth := &Authenticator{Tracer: noop.NewTracerProvider().Tracer("")}

	md := encodeIdentityInMetadata(before)
	after, err := auth.decodeMetadata(md)
	require.NoError(t, err)
	require.Equal(t, before.GetID(), after.GetID())
	require.Equal(t, before.GetUID(), after.GetUID())
	require.Equal(t, before.GetIdentityType(), after.GetIdentityType())
	require.Equal(t, before.GetLogin(), after.GetLogin())
	require.Equal(t, before.GetOrgID(), after.GetOrgID())
	require.Equal(t, before.GetOrgName(), after.GetOrgName())
	require.Equal(t, before.GetOrgRole(), after.GetOrgRole())
}
