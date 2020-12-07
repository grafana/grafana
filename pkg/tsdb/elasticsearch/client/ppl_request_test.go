package es

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"

	. "github.com/smartystreets/goconvey/convey"
)

func TestPPLRequest(t *testing.T) {
	Convey("Test elasticsearch PPL request", t, func() {
		timeField := "@timestamp"
		index := "default_index"
		Convey("Given new PPL request builder", func() {
			b := NewPPLRequestBuilder(index)

			Convey("When building PPL request", func() {
				pr, err := b.Build()
				So(err, ShouldBeNil)

				Convey("When marshal to JSON should generate correct json", func() {
					body, err := json.Marshal(pr)
					So(err, ShouldBeNil)
					json, err := simplejson.NewJson(body)
					So(err, ShouldBeNil)
					So(json.Get("query").Interface(), ShouldEqual, "")
				})
			})

			Convey("When adding default query", func() {
				b.AddPPLQueryString(timeField, "$timeTo", "$timeFrom", "")

				Convey("When building PPL request", func() {
					pr, err := b.Build()
					So(err, ShouldBeNil)

					Convey("Should have query string filter", func() {
						f := pr.Query
						So(f, ShouldEqual, "source = default_index | where `@timestamp` >= timestamp('$timeFrom') and `@timestamp` <= timestamp('$timeTo')")
					})

					Convey("When marshal to JSON should generate correct json", func() {
						body, err := json.Marshal(pr)
						So(err, ShouldBeNil)
						json, err := simplejson.NewJson(body)
						So(err, ShouldBeNil)
						So(json.Get("query").Interface(), ShouldEqual, "source = default_index | where `@timestamp` >= timestamp('$timeFrom') and `@timestamp` <= timestamp('$timeTo')")
					})
				})
			})
			Convey("When adding PPL query", func() {
				b.AddPPLQueryString(timeField, "$timeTo", "$timeFrom", "source = index | fields test")

				Convey("When building PPL request", func() {
					pr, err := b.Build()
					So(err, ShouldBeNil)

					Convey("Should have query string filter", func() {
						f := pr.Query
						So(f, ShouldEqual, "source = index | where `@timestamp` >= timestamp('$timeFrom') and `@timestamp` <= timestamp('$timeTo') | fields test")
					})

					Convey("When marshal to JSON should generate correct json", func() {
						body, err := json.Marshal(pr)
						So(err, ShouldBeNil)
						json, err := simplejson.NewJson(body)
						So(err, ShouldBeNil)
						So(json.Get("query").Interface(), ShouldEqual, "source = index | where `@timestamp` >= timestamp('$timeFrom') and `@timestamp` <= timestamp('$timeTo') | fields test")
					})
				})
			})
		})
	})
}
