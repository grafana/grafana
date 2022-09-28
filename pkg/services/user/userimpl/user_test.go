package userimpl

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/stretchr/testify/require"
)

func TestUserService(t *testing.T) {
	userStore := newUserStoreFake()
	orgService := orgtest.NewOrgServiceFake()
	userService := Service{
		store:      userStore,
		orgService: orgService,
	}

	t.Run("create user", func(t *testing.T) {
		_, err := userService.Create(context.Background(), &user.CreateUserCommand{
			Email: "email",
			Login: "login",
			Name:  "name",
		})
		require.NoError(t, err)
	})

	t.Run("get user by ID", func(t *testing.T) {
		userService.cfg = setting.NewCfg()
		userService.cfg.CaseInsensitiveLogin = false
		userStore.ExpectedUser = &user.User{ID: 1, Email: "email", Login: "login", Name: "name"}
		u, err := userService.GetByID(context.Background(), &user.GetUserByIDQuery{ID: 1})
		require.NoError(t, err)
		require.Equal(t, "login", u.Login)
		require.Equal(t, "name", u.Name)
		require.Equal(t, "email", u.Email)
	})

	t.Run("get user by ID with case insensitive login", func(t *testing.T) {
		userService.cfg = setting.NewCfg()
		userService.cfg.CaseInsensitiveLogin = true
		userStore.ExpectedUser = &user.User{ID: 1, Email: "email", Login: "login", Name: "name"}
		u, err := userService.GetByID(context.Background(), &user.GetUserByIDQuery{ID: 1})
		require.NoError(t, err)
		require.Equal(t, "login", u.Login)
		require.Equal(t, "name", u.Name)
		require.Equal(t, "email", u.Email)
	})

	t.Run("delete user store returns error", func(t *testing.T) {
		userStore.ExpectedDeleteUserError = user.ErrUserNotFound
		t.Cleanup(func() {
			userStore.ExpectedDeleteUserError = nil
		})
		err := userService.Delete(context.Background(), &user.DeleteUserCommand{UserID: 1})
		require.Error(t, err, user.ErrUserNotFound)
	})

	t.Run("delete user successfully", func(t *testing.T) {
		err := userService.Delete(context.Background(), &user.DeleteUserCommand{UserID: 1})
		require.NoError(t, err)
	})

	t.Run("delete user store returns error", func(t *testing.T) {
		userStore.ExpectedDeleteUserError = user.ErrUserNotFound
		t.Cleanup(func() {
			userStore.ExpectedDeleteUserError = nil
		})
		err := userService.Delete(context.Background(), &user.DeleteUserCommand{UserID: 1})
		require.Error(t, err, user.ErrUserNotFound)
	})

	t.Run("delete user successfully", func(t *testing.T) {
		err := userService.Delete(context.Background(), &user.DeleteUserCommand{UserID: 1})
		require.NoError(t, err)
	})

	t.Run("GetByID - email conflict", func(t *testing.T) {
		userService.cfg.CaseInsensitiveLogin = true
		userStore.ExpectedError = errors.New("email conflict")
		query := user.GetUserByIDQuery{}
		_, err := userService.GetByID(context.Background(), &query)
		require.Error(t, err)
	})
}

type FakeUserStore struct {
	ExpectedUser            *user.User
	ExpectedError           error
	ExpectedDeleteUserError error
}

func newUserStoreFake() *FakeUserStore {
	return &FakeUserStore{}
}

func (f *FakeUserStore) Get(ctx context.Context, query *user.User) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeUserStore) Insert(ctx context.Context, query *user.User) (int64, error) {
	return 0, f.ExpectedError
}

func (f *FakeUserStore) Delete(ctx context.Context, userID int64) error {
	return f.ExpectedDeleteUserError
}

func (f *FakeUserStore) GetNotServiceAccount(ctx context.Context, userID int64) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeUserStore) GetByID(context.Context, int64) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeUserStore) CaseInsensitiveLoginConflict(context.Context, string, string) error {
	return f.ExpectedError
}

func (f *FakeUserStore) GetByLogin(ctx context.Context, query *user.GetUserByLoginQuery) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeUserStore) GetByEmail(ctx context.Context, query *user.GetUserByEmailQuery) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeUserStore) Update(ctx context.Context, cmd *user.UpdateUserCommand) error {
	return f.ExpectedError
}

func (f *FakeUserStore) ChangePassword(ctx context.Context, cmd *user.ChangeUserPasswordCommand) error {
	return f.ExpectedError
}

func (f *FakeUserStore) UpdateLastSeenAt(ctx context.Context, cmd *user.UpdateUserLastSeenAtCommand) error {
	return f.ExpectedError
}
