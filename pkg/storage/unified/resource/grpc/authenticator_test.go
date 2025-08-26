package grpc

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"

	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
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

	md := encodeIdentityInMetadataPairs(before)
	after, err := auth.decodeMetadata(metadata.Pairs(md...))
	require.NoError(t, err)
	require.Equal(t, before.GetID(), after.GetID())
	require.Equal(t, before.GetUID(), after.GetUID())
	require.Equal(t, before.GetIdentityType(), after.GetIdentityType())
	require.Equal(t, before.GetLogin(), after.GetLogin())
	require.Equal(t, before.GetOrgID(), after.GetOrgID())
	require.Equal(t, before.GetOrgName(), after.GetOrgName())
	require.Equal(t, before.GetOrgRole(), after.GetOrgRole())
}

func TestWrapContext(t *testing.T) {
	const key = "some-random-metadata"

	ctx := metadata.NewOutgoingContext(context.Background(), metadata.Pairs(key, "random-metadata"))
	ctx, _ = identity.WithServiceIdentity(ctx, 12345)
	var err error
	ctx, err = wrapContext(ctx)
	require.NoError(t, err)

	outmd, ok := metadata.FromOutgoingContext(ctx)
	require.True(t, ok)
	val := outmd.Get(key)
	require.Equal(t, []string{"random-metadata"}, val)
}

func TestWrapContextWithNoPreviousMetadata(t *testing.T) {
	ctx, _ := identity.WithServiceIdentity(context.Background(), 12345)
	ctx, err := wrapContext(ctx)
	require.NoError(t, err)

	outmd, ok := metadata.FromOutgoingContext(ctx)
	require.True(t, ok)
	val := outmd.Get(mdOrgID)
	require.Equal(t, []string{"12345"}, val)
}
