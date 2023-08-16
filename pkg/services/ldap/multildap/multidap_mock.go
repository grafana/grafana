package multildap

import (
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
)

type MultiLDAPmock struct {
	MultiLDAP
	ID          int64
	UserCalled  bool
	LoginCalled bool
	UserInfo    *user.User
	AuthModule  string
	ExpectedErr error
}

func (m *MultiLDAPmock) Login(query *login.LoginUserQuery) (
	*login.ExternalUserInfo, error,
) {
	m.LoginCalled = true
	query.User = m.UserInfo
	query.AuthModule = m.AuthModule
	result := &login.ExternalUserInfo{
		UserId: m.ID,
	}
	return result, m.ExpectedErr
}

func (m *MultiLDAPmock) User(loginstr string) (
	*login.ExternalUserInfo,
	ldap.ServerConfig,
	error,
) {
	m.UserCalled = true
	result := &login.ExternalUserInfo{
		UserId: m.ID,
	}
	return result, ldap.ServerConfig{}, nil
}
