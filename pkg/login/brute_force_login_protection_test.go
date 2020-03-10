package login

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestLoginAttemptsValidation(t *testing.T) {
	Convey("Validate login attempts", t, func() {
		Convey("Given brute force login protection enabled", func() {
			setting.DisableBruteForceLoginProtection = false

			Convey("When user login attempt count equals max-1 ", func() {
				withLoginAttempts(maxInvalidLoginAttempts - 1)
				err := validateLoginAttempts("user")

				Convey("it should not result in error", func() {
					So(err, ShouldBeNil)
				})
			})

			Convey("When user login attempt count equals max ", func() {
				withLoginAttempts(maxInvalidLoginAttempts)
				err := validateLoginAttempts("user")

				Convey("it should result in too many login attempts error", func() {
					So(err, ShouldEqual, ErrTooManyLoginAttempts)
				})
			})

			Convey("When user login attempt count is greater than max ", func() {
				withLoginAttempts(maxInvalidLoginAttempts + 5)
				err := validateLoginAttempts("user")

				Convey("it should result in too many login attempts error", func() {
					So(err, ShouldEqual, ErrTooManyLoginAttempts)
				})
			})

			Convey("When saving invalid login attempt", func() {
				defer bus.ClearBusHandlers()
				createLoginAttemptCmd := &models.CreateLoginAttemptCommand{}

				bus.AddHandler("test", func(cmd *models.CreateLoginAttemptCommand) error {
					createLoginAttemptCmd = cmd
					return nil
				})

				err := saveInvalidLoginAttempt(&models.LoginUserQuery{
					Username:  "user",
					Password:  "pwd",
					IpAddress: "192.168.1.1:56433",
				})
				So(err, ShouldBeNil)

				Convey("it should dispatch command", func() {
					So(createLoginAttemptCmd, ShouldNotBeNil)
					So(createLoginAttemptCmd.Username, ShouldEqual, "user")
					So(createLoginAttemptCmd.IpAddress, ShouldEqual, "192.168.1.1:56433")
				})
			})
		})

		Convey("Given brute force login protection disabled", func() {
			setting.DisableBruteForceLoginProtection = true

			Convey("When user login attempt count equals max-1 ", func() {
				withLoginAttempts(maxInvalidLoginAttempts - 1)
				err := validateLoginAttempts("user")

				Convey("it should not result in error", func() {
					So(err, ShouldBeNil)
				})
			})

			Convey("When user login attempt count equals max ", func() {
				withLoginAttempts(maxInvalidLoginAttempts)
				err := validateLoginAttempts("user")

				Convey("it should not result in error", func() {
					So(err, ShouldBeNil)
				})
			})

			Convey("When user login attempt count is greater than max ", func() {
				withLoginAttempts(maxInvalidLoginAttempts + 5)
				err := validateLoginAttempts("user")

				Convey("it should not result in error", func() {
					So(err, ShouldBeNil)
				})
			})

			Convey("When saving invalid login attempt", func() {
				defer bus.ClearBusHandlers()
				createLoginAttemptCmd := (*models.CreateLoginAttemptCommand)(nil)

				bus.AddHandler("test", func(cmd *models.CreateLoginAttemptCommand) error {
					createLoginAttemptCmd = cmd
					return nil
				})

				err := saveInvalidLoginAttempt(&models.LoginUserQuery{
					Username:  "user",
					Password:  "pwd",
					IpAddress: "192.168.1.1:56433",
				})
				So(err, ShouldBeNil)

				Convey("it should not dispatch command", func() {
					So(createLoginAttemptCmd, ShouldBeNil)
				})
			})
		})
	})
}

func withLoginAttempts(loginAttempts int64) {
	bus.AddHandler("test", func(query *models.GetUserLoginAttemptCountQuery) error {
		query.Result = loginAttempts
		return nil
	})
}
