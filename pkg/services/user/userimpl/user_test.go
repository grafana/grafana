package userimpl

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestUserService(t *testing.T) {
	userStore := newUserStoreFake()
	orgService := orgtest.NewOrgServiceFake()
	userService := Service{
		store:        userStore,
		orgService:   orgService,
		cacheService: localcache.ProvideService(),
		teamService:  &teamtest.FakeService{},
	}
	userService.cfg = setting.NewCfg()

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

	t.Run("Testing DB - return list users based on their is_disabled flag", func(t *testing.T) {
		userStore := newUserStoreFake()
		orgService := orgtest.NewOrgServiceFake()
		userService := Service{
			store:        userStore,
			orgService:   orgService,
			cacheService: localcache.ProvideService(),
			teamService:  teamtest.NewFakeService(),
		}
		usr := &user.SignedInUser{
			OrgID:       1,
			Permissions: map[int64]map[string][]string{1: {"users:read": {"global.users:*"}}},
		}

		usr2 := &user.SignedInUser{
			OrgID:       0,
			Permissions: map[int64]map[string][]string{1: {"users:read": {"global.users:*"}}},
		}

		query1 := &user.GetSignedInUserQuery{OrgID: 1, UserID: 1}
		userStore.ExpectedSignedInUser = usr
		orgService.ExpectedUserOrgDTO = []*org.UserOrgDTO{{OrgID: 0}, {OrgID: 1}}
		result, err := userService.GetSignedInUserWithCacheCtx(context.Background(), query1)
		require.Nil(t, err)
		require.NotNil(t, result)
		assert.Equal(t, query1.OrgID, result.OrgID)
		userStore.ExpectedSignedInUser = usr2
		query2 := &user.GetSignedInUserQuery{OrgID: 0, UserID: 1}
		result2, err := userService.GetSignedInUserWithCacheCtx(context.Background(), query2)
		require.Nil(t, err)
		require.NotNil(t, result2)
		assert.Equal(t, query2.OrgID, result2.OrgID)
	})

	t.Run("NewAnonymousSignedInUser", func(t *testing.T) {
		t.Run("should error when anonymous access is disabled", func(t *testing.T) {
			userService.cfg = setting.NewCfg()
			userService.cfg.AnonymousEnabled = false
			_, err := userService.NewAnonymousSignedInUser(context.Background())
			require.Error(t, err)
		})

		t.Run("should return user when anonymous access is enabled and org is not set", func(t *testing.T) {
			userService.cfg = setting.NewCfg()
			userService.cfg.AnonymousEnabled = true
			u, err := userService.NewAnonymousSignedInUser(context.Background())
			require.NoError(t, err)
			require.Equal(t, true, u.IsAnonymous)
			require.Equal(t, int64(0), u.UserID)
			require.Equal(t, "", u.OrgName)
			require.Equal(t, roletype.RoleType(""), u.OrgRole)
		})

		t.Run("should return user with org info when anonymous access is enabled and org is set", func(t *testing.T) {
			userService.cfg = setting.NewCfg()
			userService.cfg.AnonymousEnabled = true
			userService.cfg.AnonymousOrgName = "anonymous"
			userService.cfg.AnonymousOrgRole = "anonymous"
			orgService.ExpectedOrg = &org.Org{Name: "anonymous", ID: 123}
			u, err := userService.NewAnonymousSignedInUser(context.Background())
			require.NoError(t, err)
			require.Equal(t, true, u.IsAnonymous)
			require.Equal(t, int64(0), u.UserID)
			require.Equal(t, orgService.ExpectedOrg.ID, u.OrgID)
			require.Equal(t, orgService.ExpectedOrg.Name, u.OrgName)
			require.Equal(t, roletype.RoleType(userService.cfg.AnonymousOrgRole), u.OrgRole)
		})
	})

	t.Run("Can set using org", func(t *testing.T) {
		cmd := user.SetUsingOrgCommand{UserID: 2, OrgID: 1}
		orgService.ExpectedUserOrgDTO = []*org.UserOrgDTO{{OrgID: 1}}
		userStore.ExpectedError = nil
		err := userService.SetUsingOrg(context.Background(), &cmd)
		require.NoError(t, err)

		t.Run("SignedInUserQuery with a different org", func(t *testing.T) {
			query := user.GetSignedInUserQuery{UserID: 2}
			userStore.ExpectedSignedInUser = &user.SignedInUser{
				OrgID:   1,
				Email:   "ac2@test.com",
				Name:    "ac2 name",
				Login:   "ac2",
				OrgName: "ac1@test.com",
			}
			queryResult, err := userService.GetSignedInUser(context.Background(), &query)

			require.NoError(t, err)
			require.EqualValues(t, queryResult.OrgID, 1)
			require.Equal(t, queryResult.Email, "ac2@test.com")
			require.Equal(t, queryResult.Name, "ac2 name")
			require.Equal(t, queryResult.Login, "ac2")
			require.Equal(t, queryResult.OrgName, "ac1@test.com")
		})
	})
}

type FakeUserStore struct {
	ExpectedUser                  *user.User
	ExpectedSignedInUser          *user.SignedInUser
	ExpectedUserProfile           *user.UserProfileDTO
	ExpectedSearchUserQueryResult *user.SearchUserQueryResult
	ExpectedError                 error
	ExpectedDeleteUserError       error
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

func (f *FakeUserStore) LoginConflict(context.Context, string, string, bool) error {
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

func (f *FakeUserStore) GetSignedInUser(ctx context.Context, query *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
	return f.ExpectedSignedInUser, f.ExpectedError
}

func (f *FakeUserStore) UpdateUser(ctx context.Context, user *user.User) error {
	return f.ExpectedError
}

func (f *FakeUserStore) GetProfile(ctx context.Context, query *user.GetUserProfileQuery) (*user.UserProfileDTO, error) {
	return f.ExpectedUserProfile, f.ExpectedError
}

func (f *FakeUserStore) SetHelpFlag(ctx context.Context, cmd *user.SetUserHelpFlagCommand) error {
	return f.ExpectedError
}

func (f *FakeUserStore) UpdatePermissions(ctx context.Context, userID int64, isAdmin bool) error {
	return f.ExpectedError
}

func (f *FakeUserStore) BatchDisableUsers(ctx context.Context, cmd *user.BatchDisableUsersCommand) error {
	return f.ExpectedError
}

func (f *FakeUserStore) Disable(ctx context.Context, cmd *user.DisableUserCommand) error {
	return f.ExpectedError
}

func (f *FakeUserStore) Search(ctx context.Context, query *user.SearchUsersQuery) (*user.SearchUserQueryResult, error) {
	return f.ExpectedSearchUserQueryResult, f.ExpectedError
}

func (f *FakeUserStore) Count(ctx context.Context) (int64, error) {
	return 0, nil
}
