package elasticsearch

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestElasticsearchGetIndexList(t *testing.T) {
	Convey("Test Elasticsearch getIndex ", t, func() {

		Convey("Single Day", func() {
			index := getIndex("[logstash-]YYYY.MM.DD", "Daily")
			So(index, ShouldEqual, "logstash-*")
		})

		Convey("No Interval", func() {
			index := getIndex("logstash-*", "")
			So(index, ShouldEqual, "logstash-*")
		})
	})
}
