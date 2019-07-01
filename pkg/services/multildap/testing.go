package multildap

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
)

// MockLDAP represents testing struct for ldap testing
type MockLDAP struct {
	dialCalledTimes  int
	loginCalledTimes int
	closeCalledTimes int
	usersCalledTimes int

	dialErrReturn error

	loginErrReturn error
	loginReturn    *models.ExternalUserInfo

	usersErrReturn   error
	usersFirstReturn []*models.ExternalUserInfo
	usersRestReturn  []*models.ExternalUserInfo
}

// Login test fn
func (mock *MockLDAP) Login(*models.LoginUserQuery) (*models.ExternalUserInfo, error) {

	mock.loginCalledTimes = mock.loginCalledTimes + 1
	return mock.loginReturn, mock.loginErrReturn
}

// Users test fn
func (mock *MockLDAP) Users([]string) ([]*models.ExternalUserInfo, error) {
	mock.usersCalledTimes = mock.usersCalledTimes + 1

	if mock.usersCalledTimes == 1 {
		return mock.usersFirstReturn, mock.usersErrReturn
	}

	return mock.usersRestReturn, mock.usersErrReturn
}

// Auth test fn
func (mock *MockLDAP) Auth(string, string) error {
	return nil
}

// Dial test fn
func (mock *MockLDAP) Dial() error {
	mock.dialCalledTimes = mock.dialCalledTimes + 1
	return mock.dialErrReturn
}

// Close test fn
func (mock *MockLDAP) Close() {
	mock.closeCalledTimes = mock.closeCalledTimes + 1
}

// MockMultiLDAP represents testing struct for multildap testing
type MockMultiLDAP struct {
	LoginCalledTimes int
	UsersCalledTimes int
	UserCalledTimes  int

	UsersResult []*models.ExternalUserInfo
}

// Login test fn
func (mock *MockMultiLDAP) Login(query *models.LoginUserQuery) (
	*models.ExternalUserInfo, error,
) {
	mock.LoginCalledTimes = mock.LoginCalledTimes + 1
	return nil, nil
}

// Users test fn
func (mock *MockMultiLDAP) Users(logins []string) (
	[]*models.ExternalUserInfo, error,
) {
	mock.UsersCalledTimes = mock.UsersCalledTimes + 1
	return mock.UsersResult, nil
}

// User test fn
func (mock *MockMultiLDAP) User(login string) (
	*models.ExternalUserInfo, error,
) {
	mock.UserCalledTimes = mock.UserCalledTimes + 1
	return nil, nil
}

func setup() *MockLDAP {
	mock := &MockLDAP{}

	newLDAP = func(config *ldap.ServerConfig) ldap.IServer {
		return mock
	}

	return mock
}

func teardown() {
	newLDAP = ldap.New
}
