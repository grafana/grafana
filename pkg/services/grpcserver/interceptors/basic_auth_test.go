package interceptors

import (
	"context"
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func TestBasicAuthenticator_Authenticate(t *testing.T) {
	username := "admin"
	password := "secret"

	t.Run("accepts valid credentials", func(t *testing.T) {
		auth := NewBasicAuthenticator(username, password)
		ctx := newBasicAuthContext(username, password)
		_, err := auth.Authenticate(ctx)
		require.NoError(t, err)
	})

	t.Run("rejects invalid username", func(t *testing.T) {
		auth := NewBasicAuthenticator(username, password)
		ctx := newBasicAuthContext("wrong", password)
		_, err := auth.Authenticate(ctx)
		require.Error(t, err)
		require.Equal(t, codes.Unauthenticated, status.Code(err))
	})

	t.Run("rejects invalid password", func(t *testing.T) {
		auth := NewBasicAuthenticator(username, password)
		ctx := newBasicAuthContext(username, "wrong")
		_, err := auth.Authenticate(ctx)
		require.Error(t, err)
		require.Equal(t, codes.Unauthenticated, status.Code(err))
	})

	t.Run("rejects missing authorization header", func(t *testing.T) {
		auth := NewBasicAuthenticator(username, password)
		ctx := context.Background()
		md := metadata.New(map[string]string{})
		ctx = metadata.NewIncomingContext(ctx, md)
		_, err := auth.Authenticate(ctx)
		require.Error(t, err)
		require.Equal(t, codes.Unauthenticated, status.Code(err))
	})

	t.Run("rejects malformed authorization header", func(t *testing.T) {
		auth := NewBasicAuthenticator(username, password)
		ctx := context.Background()
		md := metadata.New(map[string]string{})
		md["authorization"] = []string{"Bearer token"}
		ctx = metadata.NewIncomingContext(ctx, md)
		_, err := auth.Authenticate(ctx)
		require.Error(t, err)
		require.Equal(t, codes.Unauthenticated, status.Code(err))
	})

	t.Run("rejects invalid base64 encoding", func(t *testing.T) {
		auth := NewBasicAuthenticator(username, password)
		ctx := context.Background()
		md := metadata.New(map[string]string{})
		md["authorization"] = []string{"Basic invalid!!!base64"}
		ctx = metadata.NewIncomingContext(ctx, md)
		_, err := auth.Authenticate(ctx)
		require.Error(t, err)
		require.Equal(t, codes.Unauthenticated, status.Code(err))
	})

	t.Run("removes auth header from context", func(t *testing.T) {
		auth := NewBasicAuthenticator(username, password)
		ctx := newBasicAuthContext(username, password)
		md, ok := metadata.FromIncomingContext(ctx)
		require.True(t, ok)
		require.NotEmpty(t, md["authorization"])

		ctx, err := auth.Authenticate(ctx)
		require.NoError(t, err)
		md, ok = metadata.FromIncomingContext(ctx)
		require.True(t, ok)
		require.Empty(t, md["authorization"])
	})
}

func newBasicAuthContext(username, password string) context.Context {
	ctx := context.Background()
	credentials := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
	md := metadata.New(map[string]string{})
	md["authorization"] = []string{"Basic " + credentials}
	return metadata.NewIncomingContext(ctx, md)
}
