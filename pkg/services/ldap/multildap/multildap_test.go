package multildap

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/setting"

	//TODO(sh0rez): remove once import cycle resolved
	_ "github.com/grafana/grafana/pkg/api/response"
)

func TestMultiLDAP(t *testing.T) {
	t.Run("Ping()", func(t *testing.T) {
		t.Run("Should return error for absent config list", func(t *testing.T) {
			setup()

			multi := New([]*ldap.ServerConfig{}, setting.NewCfg())
			_, err := multi.Ping()

			require.Error(t, err)
			require.Equal(t, ErrNoLDAPServers, err)

			teardown()
		})
		t.Run("Should return an unavailable status on dial error", func(t *testing.T) {
			mock := setup()

			expectedErr := errors.New("Dial error")
			mock.dialErrReturn = expectedErr

			multi := New([]*ldap.ServerConfig{
				{Host: "10.0.0.1", Port: 361},
			}, setting.NewCfg())

			statuses, err := multi.Ping()

			require.Nil(t, err)
			require.Equal(t, "10.0.0.1", statuses[0].Host)
			require.Equal(t, 361, statuses[0].Port)
			require.False(t, statuses[0].Available)
			require.Equal(t, expectedErr, statuses[0].Error)
			require.Equal(t, 0, mock.closeCalledTimes)

			teardown()
		})
		t.Run("Should get the LDAP server statuses", func(t *testing.T) {
			mock := setup()

			multi := New([]*ldap.ServerConfig{
				{Host: "10.0.0.1", Port: 361},
			}, setting.NewCfg())

			statuses, err := multi.Ping()

			require.Nil(t, err)
			require.Equal(t, "10.0.0.1", statuses[0].Host)
			require.Equal(t, 361, statuses[0].Port)
			require.True(t, statuses[0].Available)
			require.Nil(t, statuses[0].Error)
			require.Equal(t, 1, mock.closeCalledTimes)

			teardown()
		})
	})
	t.Run("Login()", func(t *testing.T) {
		t.Run("Should return error for absent config list", func(t *testing.T) {
			setup()

			multi := New([]*ldap.ServerConfig{}, setting.NewCfg())
			_, err := multi.Login(&login.LoginUserQuery{})

			require.Error(t, err)
			require.Equal(t, ErrNoLDAPServers, err)

			teardown()
		})

		t.Run("Should return a dial error", func(t *testing.T) {
			mock := setup()

			expected := errors.New("Dial error")
			mock.dialErrReturn = expected

			multi := New([]*ldap.ServerConfig{
				{}, {},
			}, setting.NewCfg())

			_, err := multi.Login(&login.LoginUserQuery{})

			require.Error(t, err)
			require.Equal(t, expected, err)

			teardown()
		})

		t.Run("Should call underlying LDAP methods", func(t *testing.T) {
			mock := setup()
			mock.loginErrReturn = ErrInvalidCredentials

			multi := New([]*ldap.ServerConfig{
				{}, {},
			}, setting.NewCfg())
			_, err := multi.Login(&login.LoginUserQuery{})

			require.Equal(t, 2, mock.dialCalledTimes)
			require.Equal(t, 2, mock.loginCalledTimes)
			require.Equal(t, 2, mock.closeCalledTimes)

			require.Equal(t, ldap.ErrInvalidCredentials, err)

			teardown()
		})

		t.Run("Should get login result", func(t *testing.T) {
			mock := setup()

			mock.loginReturn = &login.ExternalUserInfo{
				Login: "killa",
			}

			multi := New([]*ldap.ServerConfig{
				{}, {},
			}, setting.NewCfg())
			result, err := multi.Login(&login.LoginUserQuery{})

			require.Equal(t, 1, mock.dialCalledTimes)
			require.Equal(t, 1, mock.loginCalledTimes)
			require.Equal(t, 1, mock.closeCalledTimes)

			require.Equal(t, "killa", result.Login)
			require.Nil(t, err)

			teardown()
		})

		t.Run("Should still call a second error for invalid not found error", func(t *testing.T) {
			mock := setup()

			mock.loginErrReturn = ErrCouldNotFindUser

			multi := New([]*ldap.ServerConfig{
				{}, {},
			}, setting.NewCfg())
			_, err := multi.Login(&login.LoginUserQuery{})

			require.Equal(t, 2, mock.dialCalledTimes)
			require.Equal(t, 2, mock.loginCalledTimes)
			require.Equal(t, 2, mock.closeCalledTimes)

			require.Equal(t, ErrCouldNotFindUser, err)

			teardown()
		})

		t.Run("Should still try to auth with the second server after receiving an invalid credentials error from the first", func(t *testing.T) {
			mock := setup()

			mock.loginErrReturn = ErrInvalidCredentials

			multi := New([]*ldap.ServerConfig{
				{}, {},
			}, setting.NewCfg())
			_, err := multi.Login(&login.LoginUserQuery{})

			require.Equal(t, 2, mock.dialCalledTimes)
			require.Equal(t, 2, mock.loginCalledTimes)
			require.Equal(t, 2, mock.closeCalledTimes)

			require.Equal(t, ErrInvalidCredentials, err)

			teardown()
		})

		t.Run("Should still try to auth with the second server after receiving a dial error from the first", func(t *testing.T) {
			mock := setup()

			expectedError := errors.New("Dial error")
			mock.dialErrReturn = expectedError

			multi := New([]*ldap.ServerConfig{
				{}, {},
			}, setting.NewCfg())
			_, err := multi.Login(&login.LoginUserQuery{})

			require.Equal(t, 2, mock.dialCalledTimes)

			require.Equal(t, expectedError, err)

			teardown()
		})

		t.Run("Should return unknown error", func(t *testing.T) {
			mock := setup()

			expected := errors.New("Something unknown")
			mock.loginErrReturn = expected

			multi := New([]*ldap.ServerConfig{
				{}, {},
			}, setting.NewCfg())
			_, err := multi.Login(&login.LoginUserQuery{})

			require.Equal(t, 1, mock.dialCalledTimes)
			require.Equal(t, 1, mock.loginCalledTimes)
			require.Equal(t, 1, mock.closeCalledTimes)

			require.Equal(t, expected, err)

			teardown()
		})
	})

	t.Run("User()", func(t *testing.T) {
		t.Run("Should return error for absent config list", func(t *testing.T) {
			setup()

			multi := New([]*ldap.ServerConfig{}, setting.NewCfg())
			_, _, err := multi.User("test")

			require.Error(t, err)
			require.Equal(t, ErrNoLDAPServers, err)

			teardown()
		})

		t.Run("Should return a dial error", func(t *testing.T) {
			mock := setup()

			expected := errors.New("Dial error")
			mock.dialErrReturn = expected

			multi := New([]*ldap.ServerConfig{
				{}, {},
			}, setting.NewCfg())

			_, _, err := multi.User("test")

			require.Error(t, err)
			require.Equal(t, expected, err)

			teardown()
		})

		t.Run("Should call underlying LDAP methods", func(t *testing.T) {
			mock := setup()

			multi := New([]*ldap.ServerConfig{
				{}, {},
			}, setting.NewCfg())
			_, _, err := multi.User("test")

			require.Equal(t, 2, mock.dialCalledTimes)
			require.Equal(t, 2, mock.usersCalledTimes)
			require.Equal(t, 2, mock.closeCalledTimes)

			require.Equal(t, ErrDidNotFindUser, err)

			teardown()
		})

		t.Run("Should return some error", func(t *testing.T) {
			mock := setup()

			expected := errors.New("Killa Gorilla")
			mock.usersErrReturn = expected

			multi := New([]*ldap.ServerConfig{
				{}, {},
			}, setting.NewCfg())
			_, _, err := multi.User("test")

			require.Equal(t, 1, mock.dialCalledTimes)
			require.Equal(t, 1, mock.usersCalledTimes)
			require.Equal(t, 1, mock.closeCalledTimes)

			require.Equal(t, expected, err)

			teardown()
		})

		t.Run("Should get only one user", func(t *testing.T) {
			mock := setup()

			mock.usersFirstReturn = []*login.ExternalUserInfo{
				{
					Login: "one",
				},

				{
					Login: "two",
				},
			}

			multi := New([]*ldap.ServerConfig{
				{}, {},
			}, setting.NewCfg())
			user, _, err := multi.User("test")

			require.Equal(t, 1, mock.dialCalledTimes)
			require.Equal(t, 1, mock.usersCalledTimes)
			require.Equal(t, 1, mock.closeCalledTimes)

			require.Nil(t, err)
			require.Equal(t, "one", user.Login)

			teardown()
		})

		t.Run("Should still try to auth with the second server after receiving a dial error from the first", func(t *testing.T) {
			mock := setup()

			expectedError := errors.New("Dial error")
			mock.dialErrReturn = expectedError

			multi := New([]*ldap.ServerConfig{
				{}, {},
			}, setting.NewCfg())
			_, _, err := multi.User("test")

			require.Equal(t, 2, mock.dialCalledTimes)
			require.Equal(t, expectedError, err)

			teardown()
		})
	})

	t.Run("Users()", func(t *testing.T) {
		t.Run("Should still try to auth with the second server after receiving a dial error from the first", func(t *testing.T) {
			mock := setup()

			expectedError := errors.New("Dial error")
			mock.dialErrReturn = expectedError

			multi := New([]*ldap.ServerConfig{
				{}, {},
			}, setting.NewCfg())
			_, err := multi.Users([]string{"test"})

			require.Equal(t, 2, mock.dialCalledTimes)
			require.Equal(t, expectedError, err)

			teardown()
		})
		t.Run("Should return error for absent config list", func(t *testing.T) {
			setup()

			multi := New([]*ldap.ServerConfig{}, setting.NewCfg())
			_, err := multi.Users([]string{"test"})

			require.Error(t, err)
			require.Equal(t, ErrNoLDAPServers, err)

			teardown()
		})

		t.Run("Should return a dial error", func(t *testing.T) {
			mock := setup()

			expected := errors.New("Dial error")
			mock.dialErrReturn = expected

			multi := New([]*ldap.ServerConfig{
				{}, {},
			}, setting.NewCfg())

			_, err := multi.Users([]string{"test"})

			require.Error(t, err)
			require.Equal(t, expected, err)

			teardown()
		})

		t.Run("Should call underlying LDAP methods", func(t *testing.T) {
			mock := setup()

			multi := New([]*ldap.ServerConfig{
				{}, {},
			}, setting.NewCfg())
			_, err := multi.Users([]string{"test"})

			require.Equal(t, 2, mock.dialCalledTimes)
			require.Equal(t, 2, mock.usersCalledTimes)
			require.Equal(t, 2, mock.closeCalledTimes)

			require.Nil(t, err)

			teardown()
		})

		t.Run("Should return some error", func(t *testing.T) {
			mock := setup()

			expected := errors.New("Killa Gorilla")
			mock.usersErrReturn = expected

			multi := New([]*ldap.ServerConfig{
				{}, {},
			}, setting.NewCfg())
			_, err := multi.Users([]string{"test"})

			require.Equal(t, 1, mock.dialCalledTimes)
			require.Equal(t, 1, mock.usersCalledTimes)
			require.Equal(t, 1, mock.closeCalledTimes)

			require.Equal(t, expected, err)

			teardown()
		})

		t.Run("Should get users", func(t *testing.T) {
			mock := setup()

			mock.usersFirstReturn = []*login.ExternalUserInfo{
				{
					Login: "one",
				},

				{
					Login: "two",
				},
			}

			mock.usersRestReturn = []*login.ExternalUserInfo{
				{
					Login: "three",
				},
			}

			multi := New([]*ldap.ServerConfig{
				{}, {},
			}, setting.NewCfg())
			users, err := multi.Users([]string{"test"})

			require.Equal(t, 2, mock.dialCalledTimes)
			require.Equal(t, 2, mock.usersCalledTimes)
			require.Equal(t, 2, mock.closeCalledTimes)

			require.Nil(t, err)
			require.Equal(t, "one", users[0].Login)
			require.Equal(t, "two", users[1].Login)
			require.Equal(t, "three", users[2].Login)

			teardown()
		})
	})
}

// mockLDAP represents testing struct for ldap testing
type mockLDAP struct {
	dialCalledTimes  int
	loginCalledTimes int
	closeCalledTimes int
	usersCalledTimes int
	bindCalledTimes  int

	dialErrReturn error

	loginErrReturn error
	loginReturn    *login.ExternalUserInfo

	bindErrReturn error

	usersErrReturn   error
	usersFirstReturn []*login.ExternalUserInfo
	usersRestReturn  []*login.ExternalUserInfo
}

// Login test fn
func (mock *mockLDAP) Login(*login.LoginUserQuery) (*login.ExternalUserInfo, error) {
	mock.loginCalledTimes++
	return mock.loginReturn, mock.loginErrReturn
}

// Users test fn
func (mock *mockLDAP) Users([]string) ([]*login.ExternalUserInfo, error) {
	mock.usersCalledTimes++

	if mock.usersCalledTimes == 1 {
		return mock.usersFirstReturn, mock.usersErrReturn
	}

	return mock.usersRestReturn, mock.usersErrReturn
}

// UserBind test fn
func (mock *mockLDAP) UserBind(string, string) error {
	return nil
}

// Dial test fn
func (mock *mockLDAP) Dial() error {
	mock.dialCalledTimes++
	return mock.dialErrReturn
}

// Close test fn
func (mock *mockLDAP) Close() {
	mock.closeCalledTimes++
}

func (mock *mockLDAP) Bind() error {
	mock.bindCalledTimes++
	return mock.bindErrReturn
}

func setup() *mockLDAP {
	mock := &mockLDAP{}

	newLDAP = func(config *ldap.ServerConfig, cfg *setting.Cfg) ldap.IServer {
		return mock
	}

	return mock
}

func teardown() {
	newLDAP = ldap.New
}
