package multildap

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
)

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

func TestMultiLDAP(t *testing.T) {
	Convey("Multildap", t, func() {
		Convey("Login()", func() {
			Convey("Should return error for absent config list", func() {
				multi := New([]*ldap.ServerConfig{})
				_, err := multi.Login(&models.LoginUserQuery{})

				So(err, ShouldBeError)
				So(err, ShouldEqual, ErrNoLDAPServers)
			})

			Convey("Should call underlying LDAP methods", func() {
				mock := setup()

				multi := New([]*ldap.ServerConfig{
					{}, {},
				})
				_, err := multi.Login(&models.LoginUserQuery{})

				So(mock.dialCalledTimes, ShouldEqual, 2)
				So(mock.loginCalledTimes, ShouldEqual, 2)
				So(mock.closeCalledTimes, ShouldEqual, 2)

				So(err, ShouldEqual, ErrInvalidCredentials)

				teardown()
			})
		})
	})
}

// func multiLDAPScenario(desc string, fn scenarioFunc) {
// 	Convey(desc, func() {
// 		defer bus.ClearBusHandlers()

// 		sc := &scenarioContext{
// 			loginUserQuery: &models.LoginUserQuery{
// 				Username:  "user",
// 				Password:  "pwd",
// 				IpAddress: "192.168.1.1:56433",
// 			},
// 		}

// 		fn(sc)
// 	})
// }

type mockLDAP struct {
	dialCalledTimes  int
	loginCalledTimes int
	closeCalledTimes int
}

func (mock *mockLDAP) Login(*models.LoginUserQuery) (*models.ExternalUserInfo, error) {

	mock.loginCalledTimes = mock.loginCalledTimes + 1
	return nil, nil
}
func (mock *mockLDAP) Users([]string) ([]*models.ExternalUserInfo, error) {
	return nil, nil
}
func (mock *mockLDAP) ExtractGrafanaUser(*ldap.UserInfo) (*models.ExternalUserInfo, error) {
	return nil, nil
}
func (mock *mockLDAP) InitialBind(string, string) error {
	return nil
}
func (mock *mockLDAP) Dial() error {
	mock.dialCalledTimes = mock.dialCalledTimes + 1
	return nil
}
func (mock *mockLDAP) Close() {
	mock.closeCalledTimes = mock.closeCalledTimes + 1
}
