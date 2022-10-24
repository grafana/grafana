package appcontext_test

import (
	"context"
	"crypto/rand"
	"math/big"
	"testing"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	grpccontext "github.com/grafana/grafana/pkg/services/grpcserver/context"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

func TestUserFromContext(t *testing.T) {
	t.Run("should not return user", func(t *testing.T) {
		usr := appcontext.User(context.Background())
		require.Nil(t, usr)
	})

	t.Run("should return user set by ContextWithUser", func(t *testing.T) {
		expected := testUser()
		ctx := appcontext.WithUser(context.Background(), expected)
		actual := appcontext.User(ctx)
		require.Equal(t, expected.UserID, actual.UserID)
	})

	t.Run("should return user set by gRPC context", func(t *testing.T) {
		expected := testUser()
		handler := grpccontext.ProvideContextHandler(tracing.InitializeTracerForTest())
		ctx := handler.SetUser(context.Background(), expected)
		actual := appcontext.User(ctx)
		require.Equal(t, expected.UserID, actual.UserID)
	})

	t.Run("should return user set by HTTP ReqContext", func(t *testing.T) {
		expected := testUser()
		ctx := ctxkey.Set(context.Background(), &models.ReqContext{
			SignedInUser: expected,
		})
		actual := appcontext.User(ctx)
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
