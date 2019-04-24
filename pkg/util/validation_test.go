package util

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestIsEmail(t *testing.T) {

	Convey("When validating a string that is a valid email", t, func() {
		result := IsEmail("abc@def.com")

		So(result, ShouldEqual, true)
	})

	Convey("When validating a string that is not a valid email", t, func() {
		result := IsEmail("abcdef.com")

		So(result, ShouldEqual, false)
	})
}
