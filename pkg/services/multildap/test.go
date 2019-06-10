package multildap

import (
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
)

type mockLDAP struct {
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

func (mock *mockLDAP) Login(*models.LoginUserQuery) (*models.ExternalUserInfo, error) {

	mock.loginCalledTimes = mock.loginCalledTimes + 1
	return mock.loginReturn, mock.loginErrReturn
}
func (mock *mockLDAP) Users([]string) ([]*models.ExternalUserInfo, error) {
	mock.usersCalledTimes = mock.usersCalledTimes + 1

	if mock.usersCalledTimes == 1 {
		return mock.usersFirstReturn, mock.usersErrReturn
	}

	return mock.usersRestReturn, mock.usersErrReturn
}
func (mock *mockLDAP) InitialBind(string, string) error {
	return nil
}
func (mock *mockLDAP) Dial() error {
	mock.dialCalledTimes = mock.dialCalledTimes + 1
	return mock.dialErrReturn
}
func (mock *mockLDAP) Close() {
	mock.closeCalledTimes = mock.closeCalledTimes + 1
}

func setup() *mockLDAP {
	mock := &mockLDAP{}

	newLDAP = func(config *ldap.ServerConfig) ldap.IServer {
		return mock
	}

	return mock
}

func teardown() {
	newLDAP = ldap.New
}
