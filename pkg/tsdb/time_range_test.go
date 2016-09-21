package tsdb

import (
	"testing"
	"time"

	. "github.com/smartystreets/goconvey/convey"
)

func TestTimeRange(t *testing.T) {
	Convey("Time range", t, func() {

		now := time.Now()

		Convey("Can parse 5m, now", func() {
			tr := TimeRange{
				From: "5m",
				To:   "now",
				Now:  now,
			}

			Convey("5m ago ", func() {
				fiveMinAgo, _ := time.ParseDuration("-5m")
				expected := now.Add(fiveMinAgo)

				res, err := tr.FromUnix()
				So(err, ShouldBeNil)
				So(res, ShouldAlmostEqual, expected.Unix())
			})

			Convey("now ", func() {
				res, err := tr.ToUnix()
				So(err, ShouldBeNil)
				So(res, ShouldAlmostEqual, now.Unix())
			})
		})

		Convey("Can parse 5h, now-10m", func() {
			tr := TimeRange{
				From: "5h",
				To:   "now-10m",
				Now:  now,
			}

			Convey("5h ago ", func() {
				fiveMinAgo, _ := time.ParseDuration("-5h")
				expected := now.Add(fiveMinAgo)

				res, err := tr.FromUnix()
				So(err, ShouldBeNil)
				So(res, ShouldAlmostEqual, expected.Unix())
			})

			Convey("now-10m ", func() {
				fiveMinAgo, _ := time.ParseDuration("-10m")
				expected := now.Add(fiveMinAgo)
				res, err := tr.ToUnix()
				So(err, ShouldBeNil)
				So(res, ShouldAlmostEqual, expected.Unix())
			})
		})

		Convey("Cannot parse asdf", func() {
			var err error
			tr := TimeRange{
				From: "asdf",
				To:   "asdf",
				Now:  now,
			}

			_, err = tr.FromUnix()
			So(err, ShouldNotBeNil)

			_, err = tr.ToUnix()
			So(err, ShouldNotBeNil)
		})
	})
}
