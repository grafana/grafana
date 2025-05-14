package client

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/stretchr/testify/require"
)

func TestGetUserFromMeta(t *testing.T) {
	userSvcTest := usertest.NewUserServiceFake()
	userSvcTest.ExpectedUser = &user.User{
		ID:  1,
		UID: "uid-value",
	}
	client := &k8sHandler{
		userService: userSvcTest,
	}
	t.Run("returns user with valid UID", func(t *testing.T) {
		result, err := client.GetUserFromMeta(context.Background(), "user:uid-value")
		require.NoError(t, err)
		require.Equal(t, "uid-value", result.UID)
		require.Equal(t, int64(1), result.ID)
	})

	t.Run("returns user when id is passed in", func(t *testing.T) {
		result, err := client.GetUserFromMeta(context.Background(), "user:1")
		require.NoError(t, err)
		require.Equal(t, "uid-value", result.UID)
		require.Equal(t, int64(1), result.ID)
	})
}
