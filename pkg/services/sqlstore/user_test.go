package sqlstore

import (
	"fmt"
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/torkelo/grafana-pro/pkg/models"
)

func TestUserDataAccess(t *testing.T) {

	Convey("Testing User DB", t, func() {
		InitTestDB(t)

		Convey("When creating a user", func() {
			ac1cmd := m.CreateUserCommand{Login: "ac1", Email: "ac1@test.com"}

			err := CreateUser(&ac1cmd)
			So(err, ShouldBeNil)

			ac1 := ac1cmd.Result
			fmt.Printf("%v", ac1)

			Convey("Should be able to read account info projection", func() {
			})
		})
	})
}
