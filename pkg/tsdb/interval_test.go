package tsdb

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestInterval(t *testing.T) {
	Convey("Default interval ", t, func() {
		cfg := setting.NewCfg()
		cfg.Load(&setting.CommandLineArgs{
			HomePath: "../../",
		})

		calculator := NewIntervalCalculator(&IntervalOptions{})

		Convey("for 5min", func() {
			tr := NewTimeRange("5m", "now")

			interval := calculator.Calculate(tr, time.Millisecond*1)
			So(interval.Text, ShouldEqual, "200ms")
		})

		Convey("for 15min", func() {
			tr := NewTimeRange("15m", "now")

			interval := calculator.Calculate(tr, time.Millisecond*1)
			So(interval.Text, ShouldEqual, "500ms")
		})

		Convey("for 30min", func() {
			tr := NewTimeRange("30m", "now")

			interval := calculator.Calculate(tr, time.Millisecond*1)
			So(interval.Text, ShouldEqual, "1s")
		})

		Convey("for 1h", func() {
			tr := NewTimeRange("1h", "now")

			interval := calculator.Calculate(tr, time.Millisecond*1)
			So(interval.Text, ShouldEqual, "2s")
		})

		Convey("Round interval", func() {
			So(roundInterval(time.Millisecond*30), ShouldEqual, time.Millisecond*20)
			So(roundInterval(time.Millisecond*45), ShouldEqual, time.Millisecond*50)
		})

		Convey("Format value", func() {
			So(formatDuration(time.Second*61), ShouldEqual, "1m")
			So(formatDuration(time.Millisecond*30), ShouldEqual, "30ms")
			So(formatDuration(time.Hour*23), ShouldEqual, "23h")
			So(formatDuration(time.Hour*24), ShouldEqual, "1d")
			So(formatDuration(time.Hour*24*367), ShouldEqual, "1y")
		})
	})
}
