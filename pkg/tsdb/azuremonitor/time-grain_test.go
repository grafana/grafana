package azuremonitor

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestTimeGrain(t *testing.T) {
	Convey("TimeGrain", t, func() {
		tgc := &TimeGrain{}

		Convey("create ISO 8601 Duration", func() {
			Convey("when given a time unit smaller than a day", func() {
				minuteKbnDuration := tgc.createISO8601Duration(1, "m")
				hourKbnDuration := tgc.createISO8601Duration(2, "h")
				minuteDuration := tgc.createISO8601Duration(1, "minute")
				hourDuration := tgc.createISO8601Duration(2, "hour")

				Convey("should convert it to a time duration", func() {
					So(minuteKbnDuration, ShouldEqual, "PT1M")
					So(hourKbnDuration, ShouldEqual, "PT2H")

					So(minuteDuration, ShouldEqual, "PT1M")
					So(hourDuration, ShouldEqual, "PT2H")
				})
			})

			Convey("when given the day time unit", func() {
				kbnDuration := tgc.createISO8601Duration(1, "d")
				duration := tgc.createISO8601Duration(2, "day")

				Convey("should convert it to a date duration", func() {
					So(kbnDuration, ShouldEqual, "P1D")
					So(duration, ShouldEqual, "P2D")
				})
			})
		})

		Convey("create ISO 8601 Duration from Grafana interval", func() {
			Convey("and interval is less than a minute", func() {
				durationMS, _ := tgc.createISO8601DurationFromInterval("100ms")
				durationS, _ := tgc.createISO8601DurationFromInterval("59s")
				Convey("should be rounded up to a minute as is the minimum interval for Azure Monitor", func() {
					So(durationMS, ShouldEqual, "PT1M")
					So(durationS, ShouldEqual, "PT1M")
				})
			})

			Convey("and interval is more than a minute", func() {
				durationM, _ := tgc.createISO8601DurationFromInterval("10m")
				durationD, _ := tgc.createISO8601DurationFromInterval("2d")
				Convey("should be rounded up to a minute as is the minimum interval for Azure Monitor", func() {
					So(durationM, ShouldEqual, "PT10M")
					So(durationD, ShouldEqual, "P2D")
				})
			})
		})
	})
}
