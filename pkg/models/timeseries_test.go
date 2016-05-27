package models

import (
	. "github.com/smartystreets/goconvey/convey"
	"testing"
)

func TestTimeSeries(t *testing.T) {
	Convey("timeseries aggregation tests", t, func() {
		ts := NewTimeSeries("test", [][2]float64{
			{1, 0},
			{2, 0},
			{3, 0},
		})

		Convey("sum", func() {
			So(ts.Sum, ShouldEqual, 6)
		})

		Convey("avg", func() {
			So(ts.Avg, ShouldEqual, 2)
		})

		Convey("min", func() {
			So(ts.Min, ShouldEqual, 1)
		})

		Convey("max", func() {
			So(ts.Max, ShouldEqual, 3)
		})

		Convey("mean", func() {
			So(ts.Mean, ShouldEqual, 2)
		})
	})
}
