package models

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestParsingTags(t *testing.T) {
	Convey("Testing parsing a tag string into tags", t, func() {
		Convey("Can parse valid tags string", func() {
			tags := ParseTagsString("outage,type:outage,error")
			So(len(tags), ShouldEqual, 3)
			So(tags[0].Key, ShouldEqual, "outage")
			So(tags[0].Value, ShouldEqual, "")
			So(tags[1].Key, ShouldEqual, "type")
			So(tags[1].Value, ShouldEqual, "outage")
			So(tags[2].Key, ShouldEqual, "error")
			So(tags[2].Value, ShouldEqual, "")
		})

		Convey("Can parse tags string with spaces", func() {
			tags := ParseTagsString(" outage , type : outage  ,error ")
			So(len(tags), ShouldEqual, 3)
			So(tags[0].Key, ShouldEqual, "outage")
			So(tags[0].Value, ShouldEqual, "")
			So(tags[1].Key, ShouldEqual, "type")
			So(tags[1].Value, ShouldEqual, "outage")
			So(tags[2].Key, ShouldEqual, "error")
			So(tags[2].Value, ShouldEqual, "")
		})

		Convey("Can parse tags string with extra commas", func() {
			tags := ParseTagsString(" outage ,,,:, type : outage  ,error ,,,")
			So(len(tags), ShouldEqual, 3)
			So(tags[0].Key, ShouldEqual, "outage")
			So(tags[0].Value, ShouldEqual, "")
			So(tags[1].Key, ShouldEqual, "type")
			So(tags[1].Value, ShouldEqual, "outage")
			So(tags[2].Key, ShouldEqual, "error")
			So(tags[2].Value, ShouldEqual, "")
		})

		Convey("Can parse tags string with extra colons", func() {
			tags := ParseTagsString(" outage,type : outage:outage2 :outage3  ,error :")
			So(len(tags), ShouldEqual, 3)
			So(tags[0].Key, ShouldEqual, "outage")
			So(tags[0].Value, ShouldEqual, "")
			So(tags[1].Key, ShouldEqual, "type")
			So(tags[1].Value, ShouldEqual, "outage")
			So(tags[2].Key, ShouldEqual, "error")
			So(tags[2].Value, ShouldEqual, "")
		})

		Convey("Can parse tags string that contains key and values with spaces", func() {
			tags := ParseTagsString(" outage 1,type 1: outage 1  ,has error ")
			So(len(tags), ShouldEqual, 3)
			So(tags[0].Key, ShouldEqual, "outage 1")
			So(tags[0].Value, ShouldEqual, "")
			So(tags[1].Key, ShouldEqual, "type 1")
			So(tags[1].Value, ShouldEqual, "outage 1")
			So(tags[2].Key, ShouldEqual, "has error")
			So(tags[2].Value, ShouldEqual, "")
		})
	})
}
