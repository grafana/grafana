package client

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/stretchr/testify/require"
)

func TestGetUsersFromMeta(t *testing.T) {
	userSvcTest := usertest.NewUserServiceFake()
	userSvcTest.ExpectedListUsersByIdOrUid = []*user.User{
		{
			ID:  1,
			UID: "uid-value",
		},
		{
			ID:  2,
			UID: "uid-value2",
		},
	}
	client := &k8sHandler{
		userService: userSvcTest,
	}
	t.Run("returns user with valid UID", func(t *testing.T) {
		result, err := client.GetUsersFromMeta(context.Background(), []string{"user:uid-value"})
		require.NoError(t, err)
		require.Equal(t, "uid-value", result["user:uid-value"].UID)
		require.Equal(t, int64(1), result["user:uid-value"].ID)
	})

	t.Run("returns user when id is passed in", func(t *testing.T) {
		result, err := client.GetUsersFromMeta(context.Background(), []string{"user:1"})
		require.NoError(t, err)
		require.Equal(t, "uid-value", result["user:1"].UID)
		require.Equal(t, int64(1), result["user:1"].ID)
	})

	t.Run("returns users when id and uid are passed in", func(t *testing.T) {
		result, err := client.GetUsersFromMeta(context.Background(), []string{"user:1", "user:uid-value2"})
		require.NoError(t, err)
		require.Equal(t, "uid-value", result["user:1"].UID)
		require.Equal(t, int64(1), result["user:1"].ID)
		require.Equal(t, "uid-value2", result["user:uid-value2"].UID)
		require.Equal(t, int64(2), result["user:uid-value2"].ID)
	})
}
