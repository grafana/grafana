package login

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/logintest"
	"github.com/grafana/grafana/pkg/services/loginattempt/loginattempttest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestAuthenticateUser(t *testing.T) {
	authScenario(t, "When a user authenticates without setting a password", func(sc *authScenarioContext) {
		mockLoginUsingGrafanaDB(nil, sc)
		mockLoginUsingLDAP(false, nil, sc)

		loginAttemptService := &loginattempttest.FakeLoginAttemptService{ExpectedValid: true}
		cfg := setting.NewCfg()
		a := AuthenticatorService{loginAttemptService: loginAttemptService, loginService: &logintest.LoginServiceFake{}, cfg: cfg}
		err := a.AuthenticateUser(context.Background(), &login.LoginUserQuery{
			Username: "user",
			Password: "",
		})

		require.EqualError(t, err, ErrPasswordEmpty.Error())
		assert.False(t, sc.grafanaLoginWasCalled)
		assert.False(t, sc.ldapLoginWasCalled)
		assert.Empty(t, sc.loginUserQuery.AuthModule)
	})

	authScenario(t, "When user authenticates with no auth provider enabled", func(sc *authScenarioContext) {
		cfg := setting.NewCfg()
		sc.loginUserQuery.Cfg.DisableLogin = true

		loginAttemptService := &loginattempttest.MockLoginAttemptService{ExpectedValid: true}
		a := AuthenticatorService{loginAttemptService: loginAttemptService, loginService: &logintest.LoginServiceFake{}, cfg: cfg}
		err := a.AuthenticateUser(context.Background(), sc.loginUserQuery)

		require.EqualError(t, err, ErrNoAuthProvider.Error())
		assert.False(t, sc.grafanaLoginWasCalled)
		assert.False(t, sc.ldapLoginWasCalled)
		assert.Equal(t, "", sc.loginUserQuery.AuthModule)
		assert.False(t, loginAttemptService.AddCalled)
		assert.True(t, loginAttemptService.ValidateCalled)
	})

	authScenario(t, "When a user authenticates having too many login attempts", func(sc *authScenarioContext) {
		cfg := setting.NewCfg()
		mockLoginUsingGrafanaDB(nil, sc)
		mockLoginUsingLDAP(true, nil, sc)

		loginAttemptService := &loginattempttest.MockLoginAttemptService{ExpectedValid: false}
		a := AuthenticatorService{loginAttemptService: loginAttemptService, loginService: &logintest.LoginServiceFake{}, cfg: cfg}
		err := a.AuthenticateUser(context.Background(), sc.loginUserQuery)

		require.EqualError(t, err, ErrTooManyLoginAttempts.Error())
		assert.False(t, sc.grafanaLoginWasCalled)
		assert.False(t, sc.ldapLoginWasCalled)
		assert.Empty(t, sc.loginUserQuery.AuthModule)
		assert.False(t, loginAttemptService.AddCalled)
		assert.True(t, loginAttemptService.ValidateCalled)
	})

	authScenario(t, "When grafana user authenticate with valid credentials", func(sc *authScenarioContext) {
		cfg := setting.NewCfg()
		mockLoginUsingGrafanaDB(nil, sc)
		mockLoginUsingLDAP(true, ErrInvalidCredentials, sc)

		loginAttemptService := &loginattempttest.MockLoginAttemptService{ExpectedValid: true}
		a := AuthenticatorService{loginAttemptService: loginAttemptService, loginService: &logintest.LoginServiceFake{}, cfg: cfg}
		err := a.AuthenticateUser(context.Background(), sc.loginUserQuery)

		require.NoError(t, err)
		assert.True(t, sc.grafanaLoginWasCalled)
		assert.False(t, sc.ldapLoginWasCalled)
		assert.Equal(t, "grafana", sc.loginUserQuery.AuthModule)
		assert.False(t, loginAttemptService.AddCalled)
		assert.True(t, loginAttemptService.ValidateCalled)
	})

	authScenario(t, "When grafana user authenticate and unexpected error occurs", func(sc *authScenarioContext) {
		cfg := setting.NewCfg()
		customErr := errors.New("custom")
		mockLoginUsingGrafanaDB(customErr, sc)
		mockLoginUsingLDAP(true, ErrInvalidCredentials, sc)

		loginAttemptService := &loginattempttest.MockLoginAttemptService{ExpectedValid: true}
		a := AuthenticatorService{loginAttemptService: loginAttemptService, loginService: &logintest.LoginServiceFake{}, cfg: cfg}
		err := a.AuthenticateUser(context.Background(), sc.loginUserQuery)

		require.EqualError(t, err, customErr.Error())
		assert.True(t, sc.grafanaLoginWasCalled)
		assert.False(t, sc.ldapLoginWasCalled)
		assert.Equal(t, "grafana", sc.loginUserQuery.AuthModule)
		assert.False(t, loginAttemptService.AddCalled)
		assert.True(t, loginAttemptService.ValidateCalled)
	})

	authScenario(t, "When a non-existing grafana user authenticate and ldap disabled", func(sc *authScenarioContext) {
		cfg := setting.NewCfg()
		mockLoginUsingGrafanaDB(user.ErrUserNotFound, sc)
		mockLoginUsingLDAP(false, nil, sc)

		loginAttemptService := &loginattempttest.MockLoginAttemptService{ExpectedValid: true}
		a := AuthenticatorService{loginAttemptService: loginAttemptService, loginService: &logintest.LoginServiceFake{}, cfg: cfg}
		err := a.AuthenticateUser(context.Background(), sc.loginUserQuery)

		require.EqualError(t, err, user.ErrUserNotFound.Error())
		assert.True(t, sc.grafanaLoginWasCalled)
		assert.True(t, sc.ldapLoginWasCalled)
		assert.Empty(t, sc.loginUserQuery.AuthModule)
		assert.False(t, loginAttemptService.AddCalled)
		assert.True(t, loginAttemptService.ValidateCalled)
	})

	authScenario(t, "When a non-existing grafana user authenticate and invalid ldap credentials", func(sc *authScenarioContext) {
		cfg := setting.NewCfg()
		cfg.LDAPAuthEnabled = true
		mockLoginUsingGrafanaDB(user.ErrUserNotFound, sc)
		mockLoginUsingLDAP(true, ldap.ErrInvalidCredentials, sc)

		loginAttemptService := &loginattempttest.MockLoginAttemptService{ExpectedValid: true}
		a := AuthenticatorService{loginAttemptService: loginAttemptService, loginService: &logintest.LoginServiceFake{}, cfg: cfg}
		err := a.AuthenticateUser(context.Background(), sc.loginUserQuery)

		require.EqualError(t, err, ErrInvalidCredentials.Error())
		assert.True(t, sc.grafanaLoginWasCalled)
		assert.True(t, sc.ldapLoginWasCalled)
		assert.Equal(t, login.LDAPAuthModule, sc.loginUserQuery.AuthModule)
		assert.True(t, loginAttemptService.AddCalled)
		assert.True(t, loginAttemptService.ValidateCalled)
	})

	authScenario(t, "When a non-existing grafana user authenticate and valid ldap credentials", func(sc *authScenarioContext) {
		cfg := setting.NewCfg()
		cfg.LDAPAuthEnabled = true
		mockLoginUsingGrafanaDB(user.ErrUserNotFound, sc)
		mockLoginUsingLDAP(true, nil, sc)

		loginAttemptService := &loginattempttest.MockLoginAttemptService{ExpectedValid: true}
		a := AuthenticatorService{loginAttemptService: loginAttemptService, loginService: &logintest.LoginServiceFake{}, cfg: cfg}
		err := a.AuthenticateUser(context.Background(), sc.loginUserQuery)

		require.NoError(t, err)
		assert.True(t, sc.grafanaLoginWasCalled)
		assert.True(t, sc.ldapLoginWasCalled)
		assert.Equal(t, login.LDAPAuthModule, sc.loginUserQuery.AuthModule)
		assert.False(t, loginAttemptService.AddCalled)
		assert.True(t, loginAttemptService.ValidateCalled)
	})

	authScenario(t, "When a non-existing grafana user authenticate and ldap returns unexpected error", func(sc *authScenarioContext) {
		cfg := setting.NewCfg()
		cfg.LDAPAuthEnabled = true
		customErr := errors.New("custom")
		mockLoginUsingGrafanaDB(user.ErrUserNotFound, sc)
		mockLoginUsingLDAP(true, customErr, sc)

		loginAttemptService := &loginattempttest.MockLoginAttemptService{ExpectedValid: true}
		a := AuthenticatorService{loginAttemptService: loginAttemptService, loginService: &logintest.LoginServiceFake{}, cfg: cfg}
		err := a.AuthenticateUser(context.Background(), sc.loginUserQuery)

		require.EqualError(t, err, customErr.Error())
		assert.True(t, sc.grafanaLoginWasCalled)
		assert.True(t, sc.ldapLoginWasCalled)
		assert.Equal(t, login.LDAPAuthModule, sc.loginUserQuery.AuthModule)
		assert.False(t, loginAttemptService.AddCalled)
		assert.True(t, loginAttemptService.ValidateCalled)
	})

	authScenario(t, "When grafana user authenticate with invalid credentials and invalid ldap credentials", func(sc *authScenarioContext) {
		cfg := setting.NewCfg()
		cfg.LDAPAuthEnabled = true
		mockLoginUsingGrafanaDB(ErrInvalidCredentials, sc)
		mockLoginUsingLDAP(true, ldap.ErrInvalidCredentials, sc)

		loginAttemptService := &loginattempttest.MockLoginAttemptService{ExpectedValid: true}
		a := AuthenticatorService{loginAttemptService: loginAttemptService, loginService: &logintest.LoginServiceFake{}, cfg: cfg}
		err := a.AuthenticateUser(context.Background(), sc.loginUserQuery)

		require.EqualError(t, err, ErrInvalidCredentials.Error())
		assert.True(t, sc.grafanaLoginWasCalled)
		assert.True(t, sc.ldapLoginWasCalled)
		assert.True(t, loginAttemptService.AddCalled)
		assert.True(t, loginAttemptService.ValidateCalled)
	})
}

type authScenarioContext struct {
	loginUserQuery        *login.LoginUserQuery
	grafanaLoginWasCalled bool
	ldapLoginWasCalled    bool
}

type authScenarioFunc func(sc *authScenarioContext)

func mockLoginUsingGrafanaDB(err error, sc *authScenarioContext) {
	loginUsingGrafanaDB = func(ctx context.Context, query *login.LoginUserQuery, _ user.Service) error {
		sc.grafanaLoginWasCalled = true
		return err
	}
}

func mockLoginUsingLDAP(enabled bool, err error, sc *authScenarioContext) {
	loginUsingLDAP = func(ctx context.Context, query *login.LoginUserQuery, _ login.Service, _ *setting.Cfg) (bool, error) {
		sc.ldapLoginWasCalled = true
		return enabled, err
	}
}

func authScenario(t *testing.T, desc string, fn authScenarioFunc) {
	t.Helper()

	t.Run(desc, func(t *testing.T) {
		origLoginUsingGrafanaDB := loginUsingGrafanaDB
		origLoginUsingLDAP := loginUsingLDAP
		cfg := setting.Cfg{DisableLogin: false}
		sc := &authScenarioContext{
			loginUserQuery: &login.LoginUserQuery{
				Username:  "user",
				Password:  "pwd",
				IpAddress: "192.168.1.1:56433",
				Cfg:       &cfg,
			},
		}

		t.Cleanup(func() {
			loginUsingGrafanaDB = origLoginUsingGrafanaDB
			loginUsingLDAP = origLoginUsingLDAP
		})

		fn(sc)
	})
}
