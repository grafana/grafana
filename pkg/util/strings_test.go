package util

import (
	"testing"
	"time"

	. "github.com/smartystreets/goconvey/convey"
)

func TestStringsUtil(t *testing.T) {
	Convey("Falling back until none empty string", t, func() {
		So(StringsFallback2("1", "2"), ShouldEqual, "1")
		So(StringsFallback2("", "2"), ShouldEqual, "2")
		So(StringsFallback3("", "", "3"), ShouldEqual, "3")
	})
}

func TestSplitString(t *testing.T) {
	Convey("Splits strings correctly", t, func() {
		So(SplitString(""), ShouldResemble, []string{})
		So(SplitString("test"), ShouldResemble, []string{"test"})
		So(SplitString("test1 test2 test3"), ShouldResemble, []string{"test1", "test2", "test3"})
		So(SplitString("test1,test2,test3"), ShouldResemble, []string{"test1", "test2", "test3"})
		So(SplitString("test1, test2, test3"), ShouldResemble, []string{"test1", "test2", "test3"})
		So(SplitString("test1 , test2 test3"), ShouldResemble, []string{"test1", "test2", "test3"})
	})
}

func TestDateAge(t *testing.T) {
	Convey("GetAgeString", t, func() {
		So(GetAgeString(time.Time{}), ShouldEqual, "?")
		So(GetAgeString(time.Now().Add(-time.Second*2)), ShouldEqual, "< 1m")
		So(GetAgeString(time.Now().Add(-time.Minute*2)), ShouldEqual, "2m")
		So(GetAgeString(time.Now().Add(-time.Hour*2)), ShouldEqual, "2h")
		So(GetAgeString(time.Now().Add(-time.Hour*24*3)), ShouldEqual, "3d")
		So(GetAgeString(time.Now().Add(-time.Hour*24*67)), ShouldEqual, "2M")
		So(GetAgeString(time.Now().Add(-time.Hour*24*409)), ShouldEqual, "1y")
	})
}

func TestToCamelCase(t *testing.T) {
	Convey("ToCamelCase", t, func() {
		So(ToCamelCase("kebab-case-string"), ShouldEqual, "kebabCaseString")
		So(ToCamelCase("snake_case_string"), ShouldEqual, "snakeCaseString")
		So(ToCamelCase("mixed-case_string"), ShouldEqual, "mixedCaseString")
		So(ToCamelCase("alreadyCamelCase"), ShouldEqual, "alreadyCamelCase")
	})
}
