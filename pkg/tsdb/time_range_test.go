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
				now:  now,
			}

			Convey("5m ago ", func() {
				fiveMinAgo, _ := time.ParseDuration("-5m")
				expected := now.Add(fiveMinAgo)

				res, err := tr.ParseFrom()
				So(err, ShouldBeNil)
				So(res.Unix(), ShouldEqual, expected.Unix())
			})

			Convey("now ", func() {
				res, err := tr.ParseTo()
				So(err, ShouldBeNil)
				So(res.Unix(), ShouldEqual, now.Unix())
			})
		})

		Convey("Can parse 5h, now-10m", func() {
			tr := TimeRange{
				From: "5h",
				To:   "now-10m",
				now:  now,
			}

			Convey("5h ago ", func() {
				fiveHourAgo, _ := time.ParseDuration("-5h")
				expected := now.Add(fiveHourAgo)

				res, err := tr.ParseFrom()
				So(err, ShouldBeNil)
				So(res.Unix(), ShouldEqual, expected.Unix())
			})

			Convey("now-10m ", func() {
				tenMinAgo, _ := time.ParseDuration("-10m")
				expected := now.Add(tenMinAgo)
				res, err := tr.ParseTo()
				So(err, ShouldBeNil)
				So(res.Unix(), ShouldEqual, expected.Unix())
			})
		})

		Convey("can parse unix epocs", func() {
			var err error
			tr := TimeRange{
				From: "1474973725473",
				To:   "1474975757930",
				now:  now,
			}

			res, err := tr.ParseFrom()
			So(err, ShouldBeNil)
			So(res.UnixNano()/int64(time.Millisecond), ShouldEqual, 1474973725473)

			res, err = tr.ParseTo()
			So(err, ShouldBeNil)
			So(res.UnixNano()/int64(time.Millisecond), ShouldEqual, 1474975757930)
		})

		Convey("Cannot parse asdf", func() {
			var err error
			tr := TimeRange{
				From: "asdf",
				To:   "asdf",
				now:  now,
			}

			_, err = tr.ParseFrom()
			So(err, ShouldNotBeNil)

			_, err = tr.ParseTo()
			So(err, ShouldNotBeNil)
		})
	})
}
