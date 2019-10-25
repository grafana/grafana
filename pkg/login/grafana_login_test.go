package login

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
)

func TestGrafanaLogin(t *testing.T) {
	Convey("Login using Grafana DB", t, func() {
		grafanaLoginScenario("When login with non-existing user", func(sc *grafanaLoginScenarioContext) {
			sc.withNonExistingUser()
			err := loginUsingGrafanaDB(sc.loginUserQuery)

			Convey("it should result in user not found error", func() {
				So(err, ShouldEqual, m.ErrUserNotFound)
			})

			Convey("it should not call password validation", func() {
				So(sc.validatePasswordCalled, ShouldBeFalse)
			})

			Convey("it should not pupulate user object", func() {
				So(sc.loginUserQuery.User, ShouldBeNil)
			})
		})

		grafanaLoginScenario("When login with invalid credentials", func(sc *grafanaLoginScenarioContext) {
			sc.withInvalidPassword()
			err := loginUsingGrafanaDB(sc.loginUserQuery)

			Convey("it should result in invalid credentials error", func() {
				So(err, ShouldEqual, ErrInvalidCredentials)
			})

			Convey("it should call password validation", func() {
				So(sc.validatePasswordCalled, ShouldBeTrue)
			})

			Convey("it should not pupulate user object", func() {
				So(sc.loginUserQuery.User, ShouldBeNil)
			})
		})

		grafanaLoginScenario("When login with valid credentials", func(sc *grafanaLoginScenarioContext) {
			sc.withValidCredentials()
			err := loginUsingGrafanaDB(sc.loginUserQuery)

			Convey("it should not result in error", func() {
				So(err, ShouldBeNil)
			})

			Convey("it should call password validation", func() {
				So(sc.validatePasswordCalled, ShouldBeTrue)
			})

			Convey("it should pupulate user object", func() {
				So(sc.loginUserQuery.User, ShouldNotBeNil)
				So(sc.loginUserQuery.User.Login, ShouldEqual, sc.loginUserQuery.Username)
				So(sc.loginUserQuery.User.Password, ShouldEqual, sc.loginUserQuery.Password)
			})
		})

		grafanaLoginScenario("When login with disabled user", func(sc *grafanaLoginScenarioContext) {
			sc.withDisabledUser()
			err := loginUsingGrafanaDB(sc.loginUserQuery)

			Convey("it should return user is disabled error", func() {
				So(err, ShouldEqual, ErrUserDisabled)
			})

			Convey("it should not call password validation", func() {
				So(sc.validatePasswordCalled, ShouldBeFalse)
			})

			Convey("it should not pupulate user object", func() {
				So(sc.loginUserQuery.User, ShouldBeNil)
			})
		})
	})
}

type grafanaLoginScenarioContext struct {
	loginUserQuery         *m.LoginUserQuery
	validatePasswordCalled bool
}

type grafanaLoginScenarioFunc func(c *grafanaLoginScenarioContext)

func grafanaLoginScenario(desc string, fn grafanaLoginScenarioFunc) {
	Convey(desc, func() {
		origValidatePassword := validatePassword

		sc := &grafanaLoginScenarioContext{
			loginUserQuery: &m.LoginUserQuery{
				Username:  "user",
				Password:  "pwd",
				IpAddress: "192.168.1.1:56433",
			},
			validatePasswordCalled: false,
		}

		defer func() {
			validatePassword = origValidatePassword
		}()

		fn(sc)
	})
}

func mockPasswordValidation(valid bool, sc *grafanaLoginScenarioContext) {
	validatePassword = func(providedPassword string, userPassword string, userSalt string) error {
		sc.validatePasswordCalled = true

		if !valid {
			return ErrInvalidCredentials
		}

		return nil
	}
}

func (sc *grafanaLoginScenarioContext) getUserByLoginQueryReturns(user *m.User) {
	bus.AddHandler("test", func(query *m.GetUserByLoginQuery) error {
		if user == nil {
			return m.ErrUserNotFound
		}

		query.Result = user
		return nil
	})
}

func (sc *grafanaLoginScenarioContext) withValidCredentials() {
	sc.getUserByLoginQueryReturns(&m.User{
		Id:       1,
		Login:    sc.loginUserQuery.Username,
		Password: sc.loginUserQuery.Password,
		Salt:     "salt",
	})
	mockPasswordValidation(true, sc)
}

func (sc *grafanaLoginScenarioContext) withNonExistingUser() {
	sc.getUserByLoginQueryReturns(nil)
}

func (sc *grafanaLoginScenarioContext) withInvalidPassword() {
	sc.getUserByLoginQueryReturns(&m.User{
		Password: sc.loginUserQuery.Password,
		Salt:     "salt",
	})
	mockPasswordValidation(false, sc)
}

func (sc *grafanaLoginScenarioContext) withDisabledUser() {
	sc.getUserByLoginQueryReturns(&m.User{
		IsDisabled: true,
	})
}
