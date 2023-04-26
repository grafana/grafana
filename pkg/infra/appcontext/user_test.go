package appcontext_test

import (
	"context"
	"crypto/rand"
	"math/big"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	grpccontext "github.com/grafana/grafana/pkg/services/grpcserver/context"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestUserFromContext(t *testing.T) {
	t.Run("User should error when context is missing user", func(t *testing.T) {
		usr, err := appcontext.User(context.Background())
		require.Nil(t, usr)
		require.Error(t, err)
	})

	t.Run("MustUser should panic when context is missing user", func(t *testing.T) {
		require.Panics(t, func() {
			_ = appcontext.MustUser(context.Background())
		})
	})

	t.Run("should return user set by ContextWithUser", func(t *testing.T) {
		expected := testUser()
		ctx := appcontext.WithUser(context.Background(), expected)
		actual, err := appcontext.User(ctx)
		require.NoError(t, err)
		require.Equal(t, expected.UserID, actual.UserID)
	})

	t.Run("should return user set by gRPC context", func(t *testing.T) {
		expected := testUser()
		handler := grpccontext.ProvideContextHandler(tracing.InitializeTracerForTest())
		ctx := handler.SetUser(context.Background(), expected)
		actual, err := appcontext.User(ctx)
		require.NoError(t, err)
		require.Equal(t, expected.UserID, actual.UserID)
	})

	t.Run("should return user set by HTTP ReqContext", func(t *testing.T) {
		expected := testUser()
		ctx := ctxkey.Set(context.Background(), &contextmodel.ReqContext{
			SignedInUser: expected,
		})
		actual, err := appcontext.User(ctx)
		require.NoError(t, err)
		require.Equal(t, expected.UserID, actual.UserID)
	})
}

func testUser() *user.SignedInUser {
	i, err := rand.Int(rand.Reader, big.NewInt(100000))
	if err != nil {
		panic(err)
	}
	return &user.SignedInUser{
		UserID: i.Int64(),
		OrgID:  1,
	}
}
