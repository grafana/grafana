package login

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/multildap"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var errTest = errors.New("test error")

func TestLoginUsingLDAP(t *testing.T) {
	LDAPLoginScenario(t, "When LDAP enabled and no server configured", func(sc *LDAPLoginScenarioContext) {
		setting.LDAPEnabled = true

		sc.withLoginResult(false)
		getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
			config := &ldap.Config{
				Servers: []*ldap.ServerConfig{},
			}

			return config, nil
		}

		enabled, err := loginUsingLDAP(context.Background(), sc.loginUserQuery)
		require.EqualError(t, err, errTest.Error())

		assert.True(t, enabled)
		assert.True(t, sc.LDAPAuthenticatorMock.loginCalled)
	})

	LDAPLoginScenario(t, "When LDAP disabled", func(sc *LDAPLoginScenarioContext) {
		setting.LDAPEnabled = false

		sc.withLoginResult(false)
		enabled, err := loginUsingLDAP(context.Background(), sc.loginUserQuery)
		require.NoError(t, err)

		assert.False(t, enabled)
		assert.False(t, sc.LDAPAuthenticatorMock.loginCalled)
	})
}

type mockAuth struct {
	validLogin  bool
	loginCalled bool
	pingCalled  bool
}

func (auth *mockAuth) Ping() ([]*multildap.ServerStatus, error) {
	auth.pingCalled = true

	return nil, nil
}

func (auth *mockAuth) Login(query *models.LoginUserQuery) (
	*models.ExternalUserInfo,
	error,
) {
	auth.loginCalled = true

	if !auth.validLogin {
		return nil, errTest
	}

	return nil, nil
}

func (auth *mockAuth) Users(logins []string) (
	[]*models.ExternalUserInfo,
	error,
) {
	return nil, nil
}

func (auth *mockAuth) User(login string) (
	*models.ExternalUserInfo,
	ldap.ServerConfig,
	error,
) {
	return nil, ldap.ServerConfig{}, nil
}

func (auth *mockAuth) Add(dn string, values map[string][]string) error {
	return nil
}

func (auth *mockAuth) Remove(dn string) error {
	return nil
}

func mockLDAPAuthenticator(valid bool) *mockAuth {
	mock := &mockAuth{
		validLogin: valid,
	}

	newLDAP = func(servers []*ldap.ServerConfig) multildap.IMultiLDAP {
		return mock
	}

	return mock
}

type LDAPLoginScenarioContext struct {
	loginUserQuery        *models.LoginUserQuery
	LDAPAuthenticatorMock *mockAuth
}

type LDAPLoginScenarioFunc func(c *LDAPLoginScenarioContext)

func LDAPLoginScenario(t *testing.T, desc string, fn LDAPLoginScenarioFunc) {
	t.Helper()

	t.Run(desc, func(t *testing.T) {
		mock := &mockAuth{}

		sc := &LDAPLoginScenarioContext{
			loginUserQuery: &models.LoginUserQuery{
				Username:  "user",
				Password:  "pwd",
				IpAddress: "192.168.1.1:56433",
			},
			LDAPAuthenticatorMock: mock,
		}

		origNewLDAP := newLDAP
		origGetLDAPConfig := getLDAPConfig
		origLDAPEnabled := setting.LDAPEnabled
		t.Cleanup(func() {
			newLDAP = origNewLDAP
			getLDAPConfig = origGetLDAPConfig
			setting.LDAPEnabled = origLDAPEnabled
		})

		getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
			config := &ldap.Config{
				Servers: []*ldap.ServerConfig{
					{
						Host: "",
					},
				},
			}

			return config, nil
		}

		newLDAP = func(server []*ldap.ServerConfig) multildap.IMultiLDAP {
			return mock
		}

		fn(sc)
	})
}

func (sc *LDAPLoginScenarioContext) withLoginResult(valid bool) {
	sc.LDAPAuthenticatorMock = mockLDAPAuthenticator(valid)
}
