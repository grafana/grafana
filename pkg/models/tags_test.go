package models

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestParsingTags(t *testing.T) {
	Convey("Testing parsing a tag pairs into tags", t, func() {
		Convey("Can parse one empty tag", func() {
			tags := ParseTagPairs([]string{""})
			So(len(tags), ShouldEqual, 0)
		})

		Convey("Can parse valid tags", func() {
			tags := ParseTagPairs([]string{"outage", "type:outage", "error"})
			So(len(tags), ShouldEqual, 3)
			So(tags[0].Key, ShouldEqual, "outage")
			So(tags[0].Value, ShouldEqual, "")
			So(tags[1].Key, ShouldEqual, "type")
			So(tags[1].Value, ShouldEqual, "outage")
			So(tags[2].Key, ShouldEqual, "error")
			So(tags[2].Value, ShouldEqual, "")
		})

		Convey("Can parse tags with spaces", func() {
			tags := ParseTagPairs([]string{" outage ", " type : outage ", "error "})
			So(len(tags), ShouldEqual, 3)
			So(tags[0].Key, ShouldEqual, "outage")
			So(tags[0].Value, ShouldEqual, "")
			So(tags[1].Key, ShouldEqual, "type")
			So(tags[1].Value, ShouldEqual, "outage")
			So(tags[2].Key, ShouldEqual, "error")
			So(tags[2].Value, ShouldEqual, "")
		})

		Convey("Can parse empty tags", func() {
			tags := ParseTagPairs([]string{" outage ", "", "", ":", "type : outage ", "error ", "", ""})
			So(len(tags), ShouldEqual, 3)
			So(tags[0].Key, ShouldEqual, "outage")
			So(tags[0].Value, ShouldEqual, "")
			So(tags[1].Key, ShouldEqual, "type")
			So(tags[1].Value, ShouldEqual, "outage")
			So(tags[2].Key, ShouldEqual, "error")
			So(tags[2].Value, ShouldEqual, "")
		})

		Convey("Can parse tags with extra colons", func() {
			tags := ParseTagPairs([]string{" outage", "type : outage:outage2 :outage3 ", "error :"})
			So(len(tags), ShouldEqual, 3)
			So(tags[0].Key, ShouldEqual, "outage")
			So(tags[0].Value, ShouldEqual, "")
			So(tags[1].Key, ShouldEqual, "type")
			So(tags[1].Value, ShouldEqual, "outage")
			So(tags[2].Key, ShouldEqual, "error")
			So(tags[2].Value, ShouldEqual, "")
		})

		Convey("Can parse tags that contains key and values with spaces", func() {
			tags := ParseTagPairs([]string{" outage 1", "type 1: outage 1 ", "has error "})
			So(len(tags), ShouldEqual, 3)
			So(tags[0].Key, ShouldEqual, "outage 1")
			So(tags[0].Value, ShouldEqual, "")
			So(tags[1].Key, ShouldEqual, "type 1")
			So(tags[1].Value, ShouldEqual, "outage 1")
			So(tags[2].Key, ShouldEqual, "has error")
			So(tags[2].Value, ShouldEqual, "")
		})

		Convey("Can filter out duplicate tags", func() {
			tags := ParseTagPairs([]string{"test", "test", "key:val1", "key:val2"})
			So(len(tags), ShouldEqual, 3)
			So(tags[0].Key, ShouldEqual, "test")
			So(tags[0].Value, ShouldEqual, "")
			So(tags[1].Key, ShouldEqual, "key")
			So(tags[1].Value, ShouldEqual, "val1")
			So(tags[2].Key, ShouldEqual, "key")
			So(tags[2].Value, ShouldEqual, "val2")
		})

		Convey("Can join tag pairs", func() {
			tagPairs := []*Tag{
				{Key: "key1", Value: "val1"},
				{Key: "key2", Value: ""},
				{Key: "key3"},
			}
			tags := JoinTagPairs(tagPairs)
			So(len(tags), ShouldEqual, 3)
			So(tags[0], ShouldEqual, "key1:val1")
			So(tags[1], ShouldEqual, "key2")
			So(tags[2], ShouldEqual, "key3")
		})
	})
}
