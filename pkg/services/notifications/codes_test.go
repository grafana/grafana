package notifications

import (
	"testing"

	m "github.com/wangy1931/grafana/pkg/models"
	"github.com/wangy1931/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestEmailCodes(t *testing.T) {

	Convey("When generating code", t, func() {
		setting.EmailCodeValidMinutes = 120

		user := &m.User{Id: 10, Email: "t@a.com", Login: "asd", Password: "1", Rands: "2"}
		code := createUserEmailCode(user, nil)

		Convey("getLoginForCode should return login", func() {
			login := getLoginForEmailCode(code)
			So(login, ShouldEqual, "asd")
		})

		Convey("Can verify valid code", func() {
			So(validateUserEmailCode(user, code), ShouldBeTrue)
		})

		Convey("Cannot verify in-valid code", func() {
			code = "ASD"
			So(validateUserEmailCode(user, code), ShouldBeFalse)
		})

	})

}
