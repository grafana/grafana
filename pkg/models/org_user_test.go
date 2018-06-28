package models

import (
	. "github.com/smartystreets/goconvey/convey"
	"testing"
)

func TestRoleType_Includes(t *testing.T) {
	Convey("Checking role includes", t, func() {

		Convey("Empty role doesn't include any other role, even empty one", func() {
			emptyRole := RoleType("")

			So(emptyRole.Includes(emptyRole), ShouldBeFalse)
			So(emptyRole.Includes(ROLE_VIEWER), ShouldBeFalse)
			So(emptyRole.Includes(ROLE_EDITOR), ShouldBeFalse)
			So(emptyRole.Includes(ROLE_ADMIN), ShouldBeFalse)
		})

		Convey("Viewer role includes empty role", func() {
			So(ROLE_VIEWER.Includes(""), ShouldBeTrue)
			So(ROLE_VIEWER.Includes(ROLE_VIEWER), ShouldBeTrue)
			So(ROLE_VIEWER.Includes(ROLE_EDITOR), ShouldBeFalse)
			So(ROLE_VIEWER.Includes(ROLE_ADMIN), ShouldBeFalse)
		})

		Convey("Editor role includes empty role and viewer role", func() {
			So(ROLE_EDITOR.Includes(""), ShouldBeTrue)
			So(ROLE_EDITOR.Includes(ROLE_VIEWER), ShouldBeTrue)
			So(ROLE_EDITOR.Includes(ROLE_EDITOR), ShouldBeTrue)
			So(ROLE_EDITOR.Includes(ROLE_ADMIN), ShouldBeFalse)
		})

		Convey("Admin role includes every role", func() {
			So(ROLE_ADMIN.Includes(""), ShouldBeTrue)
			So(ROLE_ADMIN.Includes(ROLE_VIEWER), ShouldBeTrue)
			So(ROLE_ADMIN.Includes(ROLE_EDITOR), ShouldBeTrue)
			So(ROLE_ADMIN.Includes(ROLE_ADMIN), ShouldBeTrue)
		})
	})
}
