package models

import (
	"testing"

	"fmt"

	. "github.com/smartystreets/goconvey/convey"
)

func TestDashboardAclModel(t *testing.T) {

	Convey("When printing a PermissionType", t, func() {
		view := PERMISSION_VIEW
		printed := fmt.Sprint(view)

		Convey("Should output a friendly name", func() {
			So(printed, ShouldEqual, "View")
		})
	})
}
