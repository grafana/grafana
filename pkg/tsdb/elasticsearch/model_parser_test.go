package elasticsearch

import (
	"github.com/grafana/grafana/pkg/tsdb"
	. "github.com/smartystreets/goconvey/convey"
	"strconv"
	"strings"
	"testing"
)

func makeTime(hour int) string {
	//unixtime 1500000000 == 2017-07-14T02:40:00+00:00
	return strconv.Itoa((1500000000 + hour*60*60) * 1000)
}

func getIndexListByTime(pattern string, interval string, hour int) string {
	timeRange := &tsdb.TimeRange{
		From: makeTime(0),
		To:   makeTime(hour),
	}
	return getIndexList(pattern, interval, timeRange)
}

func TestElasticsearchGetIndexList(t *testing.T) {
	Convey("Test Elasticsearch getIndex ", t, func() {

		Convey("Parse Interval Formats", func() {
			So(getIndexListByTime("[logstash-]YYYY.MM.DD", "Daily", 48),
				ShouldEqual, "logstash-2017.07.14,logstash-2017.07.15,logstash-2017.07.16")

			So(len(strings.Split(getIndexListByTime("[logstash-]YYYY.MM.DD.HH", "Hourly", 3), ",")),
				ShouldEqual, 4)

			So(getIndexListByTime("[logstash-]YYYY.W", "Weekly", 100),
				ShouldEqual, "logstash-2017.28,logstash-2017.29")

			So(getIndexListByTime("[logstash-]YYYY.MM", "Monthly", 700),
				ShouldEqual, "logstash-2017.07,logstash-2017.08")

			So(getIndexListByTime("[logstash-]YYYY", "Yearly", 10000),
				ShouldEqual, "logstash-2017,logstash-2018,logstash-2019")
		})

		Convey("No Interval", func() {
			index := getIndexListByTime("logstash-test", "", 1)
			So(index, ShouldEqual, "logstash-test")
		})
	})
}
