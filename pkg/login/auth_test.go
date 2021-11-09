package login

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuthenticateUser(t *testing.T) {
	authScenario(t, "When a user authenticates without setting a password", func(sc *authScenarioContext) {
		mockLoginAttemptValidation(nil, sc)
		mockLoginUsingGrafanaDB(nil, sc)
		mockLoginUsingLDAP(false, nil, sc)

		loginQuery := models.LoginUserQuery{
			Username: "user",
			Password: "",
		}
		err := authenticateUser(context.Background(), &loginQuery)

		require.EqualError(t, err, ErrPasswordEmpty.Error())
		assert.False(t, sc.grafanaLoginWasCalled)
		assert.False(t, sc.ldapLoginWasCalled)
		assert.Empty(t, sc.loginUserQuery.AuthModule)
	})

	authScenario(t, "When a user authenticates having too many login attempts", func(sc *authScenarioContext) {
		mockLoginAttemptValidation(ErrTooManyLoginAttempts, sc)
		mockLoginUsingGrafanaDB(nil, sc)
		mockLoginUsingLDAP(true, nil, sc)
		mockSaveInvalidLoginAttempt(sc)

		err := authenticateUser(context.Background(), sc.loginUserQuery)

		require.EqualError(t, err, ErrTooManyLoginAttempts.Error())
		assert.True(t, sc.loginAttemptValidationWasCalled)
		assert.False(t, sc.grafanaLoginWasCalled)
		assert.False(t, sc.ldapLoginWasCalled)
		assert.False(t, sc.saveInvalidLoginAttemptWasCalled)
		assert.Empty(t, sc.loginUserQuery.AuthModule)
	})

	authScenario(t, "When grafana user authenticate with valid credentials", func(sc *authScenarioContext) {
		mockLoginAttemptValidation(nil, sc)
		mockLoginUsingGrafanaDB(nil, sc)
		mockLoginUsingLDAP(true, ErrInvalidCredentials, sc)
		mockSaveInvalidLoginAttempt(sc)

		err := authenticateUser(context.Background(), sc.loginUserQuery)

		require.NoError(t, err)
		assert.True(t, sc.loginAttemptValidationWasCalled)
		assert.True(t, sc.grafanaLoginWasCalled)
		assert.False(t, sc.ldapLoginWasCalled)
		assert.False(t, sc.saveInvalidLoginAttemptWasCalled)
		assert.Equal(t, "grafana", sc.loginUserQuery.AuthModule)
	})

	authScenario(t, "When grafana user authenticate and unexpected error occurs", func(sc *authScenarioContext) {
		customErr := errors.New("custom")
		mockLoginAttemptValidation(nil, sc)
		mockLoginUsingGrafanaDB(customErr, sc)
		mockLoginUsingLDAP(true, ErrInvalidCredentials, sc)
		mockSaveInvalidLoginAttempt(sc)

		err := authenticateUser(context.Background(), sc.loginUserQuery)

		require.EqualError(t, err, customErr.Error())
		assert.True(t, sc.loginAttemptValidationWasCalled)
		assert.True(t, sc.grafanaLoginWasCalled)
		assert.False(t, sc.ldapLoginWasCalled)
		assert.False(t, sc.saveInvalidLoginAttemptWasCalled)
		assert.Equal(t, "grafana", sc.loginUserQuery.AuthModule)
	})

	authScenario(t, "When a non-existing grafana user authenticate and ldap disabled", func(sc *authScenarioContext) {
		mockLoginAttemptValidation(nil, sc)
		mockLoginUsingGrafanaDB(models.ErrUserNotFound, sc)
		mockLoginUsingLDAP(false, nil, sc)
		mockSaveInvalidLoginAttempt(sc)

		err := authenticateUser(context.Background(), sc.loginUserQuery)

		require.EqualError(t, err, models.ErrUserNotFound.Error())
		assert.True(t, sc.loginAttemptValidationWasCalled)
		assert.True(t, sc.grafanaLoginWasCalled)
		assert.True(t, sc.ldapLoginWasCalled)
		assert.False(t, sc.saveInvalidLoginAttemptWasCalled)
		assert.Empty(t, sc.loginUserQuery.AuthModule)
	})

	authScenario(t, "When a non-existing grafana user authenticate and invalid ldap credentials", func(sc *authScenarioContext) {
		mockLoginAttemptValidation(nil, sc)
		mockLoginUsingGrafanaDB(models.ErrUserNotFound, sc)
		mockLoginUsingLDAP(true, ldap.ErrInvalidCredentials, sc)
		mockSaveInvalidLoginAttempt(sc)

		err := authenticateUser(context.Background(), sc.loginUserQuery)

		require.EqualError(t, err, ErrInvalidCredentials.Error())
		assert.True(t, sc.loginAttemptValidationWasCalled)
		assert.True(t, sc.grafanaLoginWasCalled)
		assert.True(t, sc.ldapLoginWasCalled)
		assert.True(t, sc.saveInvalidLoginAttemptWasCalled)
		assert.Equal(t, "ldap", sc.loginUserQuery.AuthModule)
	})

	authScenario(t, "When a non-existing grafana user authenticate and valid ldap credentials", func(sc *authScenarioContext) {
		mockLoginAttemptValidation(nil, sc)
		mockLoginUsingGrafanaDB(models.ErrUserNotFound, sc)
		mockLoginUsingLDAP(true, nil, sc)
		mockSaveInvalidLoginAttempt(sc)

		err := authenticateUser(context.Background(), sc.loginUserQuery)

		require.NoError(t, err)
		assert.True(t, sc.loginAttemptValidationWasCalled)
		assert.True(t, sc.grafanaLoginWasCalled)
		assert.True(t, sc.ldapLoginWasCalled)
		assert.False(t, sc.saveInvalidLoginAttemptWasCalled)
		assert.Equal(t, "ldap", sc.loginUserQuery.AuthModule)
	})

	authScenario(t, "When a non-existing grafana user authenticate and ldap returns unexpected error", func(sc *authScenarioContext) {
		customErr := errors.New("custom")
		mockLoginAttemptValidation(nil, sc)
		mockLoginUsingGrafanaDB(models.ErrUserNotFound, sc)
		mockLoginUsingLDAP(true, customErr, sc)
		mockSaveInvalidLoginAttempt(sc)

		err := authenticateUser(context.Background(), sc.loginUserQuery)

		require.EqualError(t, err, customErr.Error())
		assert.True(t, sc.loginAttemptValidationWasCalled)
		assert.True(t, sc.grafanaLoginWasCalled)
		assert.True(t, sc.ldapLoginWasCalled)
		assert.False(t, sc.saveInvalidLoginAttemptWasCalled)
		assert.Equal(t, "ldap", sc.loginUserQuery.AuthModule)
	})

	authScenario(t, "When grafana user authenticate with invalid credentials and invalid ldap credentials", func(sc *authScenarioContext) {
		mockLoginAttemptValidation(nil, sc)
		mockLoginUsingGrafanaDB(ErrInvalidCredentials, sc)
		mockLoginUsingLDAP(true, ldap.ErrInvalidCredentials, sc)
		mockSaveInvalidLoginAttempt(sc)

		err := authenticateUser(context.Background(), sc.loginUserQuery)

		require.EqualError(t, err, ErrInvalidCredentials.Error())
		assert.True(t, sc.loginAttemptValidationWasCalled)
		assert.True(t, sc.grafanaLoginWasCalled)
		assert.True(t, sc.ldapLoginWasCalled)
		assert.True(t, sc.saveInvalidLoginAttemptWasCalled)
	})
}

type authScenarioContext struct {
	loginUserQuery                   *models.LoginUserQuery
	grafanaLoginWasCalled            bool
	ldapLoginWasCalled               bool
	loginAttemptValidationWasCalled  bool
	saveInvalidLoginAttemptWasCalled bool
}

type authScenarioFunc func(sc *authScenarioContext)

func mockLoginUsingGrafanaDB(err error, sc *authScenarioContext) {
	loginUsingGrafanaDB = func(ctx context.Context, query *models.LoginUserQuery) error {
		sc.grafanaLoginWasCalled = true
		return err
	}
}

func mockLoginUsingLDAP(enabled bool, err error, sc *authScenarioContext) {
	loginUsingLDAP = func(ctx context.Context, query *models.LoginUserQuery) (bool, error) {
		sc.ldapLoginWasCalled = true
		return enabled, err
	}
}

func mockLoginAttemptValidation(err error, sc *authScenarioContext) {
	validateLoginAttempts = func(context.Context, *models.LoginUserQuery) error {
		sc.loginAttemptValidationWasCalled = true
		return err
	}
}

func mockSaveInvalidLoginAttempt(sc *authScenarioContext) {
	saveInvalidLoginAttempt = func(ctx context.Context, query *models.LoginUserQuery) error {
		sc.saveInvalidLoginAttemptWasCalled = true
		return nil
	}
}

func authScenario(t *testing.T, desc string, fn authScenarioFunc) {
	t.Helper()

	t.Run(desc, func(t *testing.T) {
		origLoginUsingGrafanaDB := loginUsingGrafanaDB
		origLoginUsingLDAP := loginUsingLDAP
		origValidateLoginAttempts := validateLoginAttempts
		origSaveInvalidLoginAttempt := saveInvalidLoginAttempt

		sc := &authScenarioContext{
			loginUserQuery: &models.LoginUserQuery{
				Username:  "user",
				Password:  "pwd",
				IpAddress: "192.168.1.1:56433",
			},
		}

		t.Cleanup(func() {
			loginUsingGrafanaDB = origLoginUsingGrafanaDB
			loginUsingLDAP = origLoginUsingLDAP
			validateLoginAttempts = origValidateLoginAttempts
			saveInvalidLoginAttempt = origSaveInvalidLoginAttempt
		})

		fn(sc)
	})
}
