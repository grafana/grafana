package userauthimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUserAuthService(t *testing.T) {
	userAuthStore := &FakeUserAuthStore{}
	userAuthService := Service{
		store: userAuthStore,
	}

	t.Run("delete user", func(t *testing.T) {
		err := userAuthService.Delete(context.Background(), 1)
		require.NoError(t, err)
	})

	t.Run("delete token", func(t *testing.T) {
		err := userAuthService.DeleteToken(context.Background(), 1)
		require.NoError(t, err)
	})
}

type FakeUserAuthStore struct {
	ExpectedError error
}

func (f *FakeUserAuthStore) Delete(ctx context.Context, userID int64) error {
	return f.ExpectedError
}

func (f *FakeUserAuthStore) DeleteToken(ctx context.Context, userID int64) error {
	return f.ExpectedError
}
