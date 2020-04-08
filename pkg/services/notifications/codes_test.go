package notifications

import (
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestEmailCodes(t *testing.T) {

	Convey("When generating code", t, func() {
		setting.EmailCodeValidMinutes = 120

		user := &models.User{Id: 10, Email: "t@a.com", Login: "asd", Password: "1", Rands: "2"}
		code, err := createUserEmailCode(user, nil)
		So(err, ShouldBeNil)

		Convey("getLoginForCode should return login", func() {
			login := getLoginForEmailCode(code)
			So(login, ShouldEqual, "asd")
		})

		Convey("Can verify valid code", func() {
			isValid, err := validateUserEmailCode(user, code)
			So(err, ShouldBeNil)
			So(isValid, ShouldBeTrue)
		})

		Convey("Cannot verify in-valid code", func() {
			code = "ASD"
			isValid, err := validateUserEmailCode(user, code)
			So(err, ShouldBeNil)
			So(isValid, ShouldBeFalse)
		})

	})

}
