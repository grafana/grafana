package login

import (
	"errors"
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
)

func TestAuthenticateUser(t *testing.T) {
	Convey("Authenticate user", t, func() {
		authScenario("When a user authenticates without setting a password", func(sc *authScenarioContext) {
			mockLoginAttemptValidation(nil, sc)
			mockLoginUsingGrafanaDB(nil, sc)
			mockLoginUsingLDAP(false, nil, sc)

			loginQuery := models.LoginUserQuery{
				Username: "user",
				Password: "",
			}
			err := AuthenticateUser(&loginQuery)

			Convey("login should fail", func() {
				So(sc.grafanaLoginWasCalled, ShouldBeFalse)
				So(sc.ldapLoginWasCalled, ShouldBeFalse)
				So(err, ShouldEqual, ErrPasswordEmpty)
				So(sc.loginUserQuery.AuthModule, ShouldEqual, "")
			})
		})

		authScenario("When a user authenticates having too many login attempts", func(sc *authScenarioContext) {
			mockLoginAttemptValidation(ErrTooManyLoginAttempts, sc)
			mockLoginUsingGrafanaDB(nil, sc)
			mockLoginUsingLDAP(true, nil, sc)
			mockSaveInvalidLoginAttempt(sc)

			err := AuthenticateUser(sc.loginUserQuery)

			Convey("it should result in", func() {
				So(err, ShouldEqual, ErrTooManyLoginAttempts)
				So(sc.loginAttemptValidationWasCalled, ShouldBeTrue)
				So(sc.grafanaLoginWasCalled, ShouldBeFalse)
				So(sc.ldapLoginWasCalled, ShouldBeFalse)
				So(sc.saveInvalidLoginAttemptWasCalled, ShouldBeFalse)
				So(sc.loginUserQuery.AuthModule, ShouldEqual, "")
			})
		})

		authScenario("When grafana user authenticate with valid credentials", func(sc *authScenarioContext) {
			mockLoginAttemptValidation(nil, sc)
			mockLoginUsingGrafanaDB(nil, sc)
			mockLoginUsingLDAP(true, ErrInvalidCredentials, sc)
			mockSaveInvalidLoginAttempt(sc)

			err := AuthenticateUser(sc.loginUserQuery)

			Convey("it should result in", func() {
				So(err, ShouldEqual, nil)
				So(sc.loginAttemptValidationWasCalled, ShouldBeTrue)
				So(sc.grafanaLoginWasCalled, ShouldBeTrue)
				So(sc.ldapLoginWasCalled, ShouldBeFalse)
				So(sc.saveInvalidLoginAttemptWasCalled, ShouldBeFalse)
				So(sc.loginUserQuery.AuthModule, ShouldEqual, "grafana")
			})
		})

		authScenario("When grafana user authenticate and unexpected error occurs", func(sc *authScenarioContext) {
			customErr := errors.New("custom")
			mockLoginAttemptValidation(nil, sc)
			mockLoginUsingGrafanaDB(customErr, sc)
			mockLoginUsingLDAP(true, ErrInvalidCredentials, sc)
			mockSaveInvalidLoginAttempt(sc)

			err := AuthenticateUser(sc.loginUserQuery)

			Convey("it should result in", func() {
				So(err, ShouldEqual, customErr)
				So(sc.loginAttemptValidationWasCalled, ShouldBeTrue)
				So(sc.grafanaLoginWasCalled, ShouldBeTrue)
				So(sc.ldapLoginWasCalled, ShouldBeFalse)
				So(sc.saveInvalidLoginAttemptWasCalled, ShouldBeFalse)
				So(sc.loginUserQuery.AuthModule, ShouldEqual, "grafana")
			})
		})

		authScenario("When a non-existing grafana user authenticate and ldap disabled", func(sc *authScenarioContext) {
			mockLoginAttemptValidation(nil, sc)
			mockLoginUsingGrafanaDB(models.ErrUserNotFound, sc)
			mockLoginUsingLDAP(false, nil, sc)
			mockSaveInvalidLoginAttempt(sc)

			err := AuthenticateUser(sc.loginUserQuery)

			Convey("it should result in", func() {
				So(err, ShouldEqual, models.ErrUserNotFound)
				So(sc.loginAttemptValidationWasCalled, ShouldBeTrue)
				So(sc.grafanaLoginWasCalled, ShouldBeTrue)
				So(sc.ldapLoginWasCalled, ShouldBeTrue)
				So(sc.saveInvalidLoginAttemptWasCalled, ShouldBeFalse)
				So(sc.loginUserQuery.AuthModule, ShouldEqual, "")
			})
		})

		authScenario("When a non-existing grafana user authenticate and invalid ldap credentials", func(sc *authScenarioContext) {
			mockLoginAttemptValidation(nil, sc)
			mockLoginUsingGrafanaDB(models.ErrUserNotFound, sc)
			mockLoginUsingLDAP(true, ldap.ErrInvalidCredentials, sc)
			mockSaveInvalidLoginAttempt(sc)

			err := AuthenticateUser(sc.loginUserQuery)

			Convey("it should result in", func() {
				So(err, ShouldEqual, ErrInvalidCredentials)
				So(sc.loginAttemptValidationWasCalled, ShouldBeTrue)
				So(sc.grafanaLoginWasCalled, ShouldBeTrue)
				So(sc.ldapLoginWasCalled, ShouldBeTrue)
				So(sc.saveInvalidLoginAttemptWasCalled, ShouldBeTrue)
				So(sc.loginUserQuery.AuthModule, ShouldEqual, "ldap")
			})
		})

		authScenario("When a non-existing grafana user authenticate and valid ldap credentials", func(sc *authScenarioContext) {
			mockLoginAttemptValidation(nil, sc)
			mockLoginUsingGrafanaDB(models.ErrUserNotFound, sc)
			mockLoginUsingLDAP(true, nil, sc)
			mockSaveInvalidLoginAttempt(sc)

			err := AuthenticateUser(sc.loginUserQuery)

			Convey("it should result in", func() {
				So(err, ShouldBeNil)
				So(sc.loginAttemptValidationWasCalled, ShouldBeTrue)
				So(sc.grafanaLoginWasCalled, ShouldBeTrue)
				So(sc.ldapLoginWasCalled, ShouldBeTrue)
				So(sc.saveInvalidLoginAttemptWasCalled, ShouldBeFalse)
				So(sc.loginUserQuery.AuthModule, ShouldEqual, "ldap")
			})
		})

		authScenario("When a non-existing grafana user authenticate and ldap returns unexpected error", func(sc *authScenarioContext) {
			customErr := errors.New("custom")
			mockLoginAttemptValidation(nil, sc)
			mockLoginUsingGrafanaDB(models.ErrUserNotFound, sc)
			mockLoginUsingLDAP(true, customErr, sc)
			mockSaveInvalidLoginAttempt(sc)

			err := AuthenticateUser(sc.loginUserQuery)

			Convey("it should result in", func() {
				So(err, ShouldEqual, customErr)
				So(sc.loginAttemptValidationWasCalled, ShouldBeTrue)
				So(sc.grafanaLoginWasCalled, ShouldBeTrue)
				So(sc.ldapLoginWasCalled, ShouldBeTrue)
				So(sc.saveInvalidLoginAttemptWasCalled, ShouldBeFalse)
				So(sc.loginUserQuery.AuthModule, ShouldEqual, "ldap")
			})
		})

		authScenario("When grafana user authenticate with invalid credentials and invalid ldap credentials", func(sc *authScenarioContext) {
			mockLoginAttemptValidation(nil, sc)
			mockLoginUsingGrafanaDB(ErrInvalidCredentials, sc)
			mockLoginUsingLDAP(true, ldap.ErrInvalidCredentials, sc)
			mockSaveInvalidLoginAttempt(sc)

			err := AuthenticateUser(sc.loginUserQuery)

			Convey("it should result in", func() {
				So(err, ShouldEqual, ErrInvalidCredentials)
				So(sc.loginAttemptValidationWasCalled, ShouldBeTrue)
				So(sc.grafanaLoginWasCalled, ShouldBeTrue)
				So(sc.ldapLoginWasCalled, ShouldBeTrue)
				So(sc.saveInvalidLoginAttemptWasCalled, ShouldBeTrue)
			})
		})
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
	loginUsingGrafanaDB = func(query *models.LoginUserQuery) error {
		sc.grafanaLoginWasCalled = true
		return err
	}
}

func mockLoginUsingLDAP(enabled bool, err error, sc *authScenarioContext) {
	loginUsingLDAP = func(query *models.LoginUserQuery) (bool, error) {
		sc.ldapLoginWasCalled = true
		return enabled, err
	}
}

func mockLoginAttemptValidation(err error, sc *authScenarioContext) {
	validateLoginAttempts = func(username string) error {
		sc.loginAttemptValidationWasCalled = true
		return err
	}
}

func mockSaveInvalidLoginAttempt(sc *authScenarioContext) {
	saveInvalidLoginAttempt = func(query *models.LoginUserQuery) error {
		sc.saveInvalidLoginAttemptWasCalled = true
		return nil
	}
}

func authScenario(desc string, fn authScenarioFunc) {
	Convey(desc, func() {
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

		defer func() {
			loginUsingGrafanaDB = origLoginUsingGrafanaDB
			loginUsingLDAP = origLoginUsingLDAP
			validateLoginAttempts = origValidateLoginAttempts
			saveInvalidLoginAttempt = origSaveInvalidLoginAttempt
		}()

		fn(sc)
	})
}
