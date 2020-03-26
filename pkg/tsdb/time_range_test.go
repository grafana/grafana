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

		now, _ = time.Parse(time.RFC3339Nano, "2020-03-26T15:12:56.000Z")
		Convey("Can parse now-1M/M, now-1M/M", func() {
			tr := TimeRange{
				From: "now-1M/M",
				To:   "now-1M/M",
				now:  now,
			}

			Convey("from now-1M/M ", func() {
				expected, _ := time.Parse(time.RFC3339Nano, "2020-02-01T00:00:00.000Z")

				res, err := tr.ParseFrom()
				So(err, ShouldBeNil)
				So(res, ShouldEqual, expected)
			})

			Convey("to now-1M/M ", func() {
				expected, _ := time.Parse(time.RFC3339Nano, "2020-02-29T23:59:59.999Z")

				res, err := tr.ParseTo()
				So(err, ShouldBeNil)
				So(res, ShouldEqual, expected)
			})
		})

		Convey("Can parse now-3d, now+3w", func() {
			tr := TimeRange{
				From: "now-3d",
				To:   "now+3w",
				now:  now,
			}

			Convey("now-3d ", func() {
				expected, _ := time.Parse(time.RFC3339Nano, "2020-03-23T15:12:56.000Z")

				res, err := tr.ParseFrom()
				So(err, ShouldBeNil)
				So(res, ShouldEqual, expected)
			})

			Convey("now+3w ", func() {
				expected, _ := time.Parse(time.RFC3339Nano, "2020-04-16T15:12:56.000Z")

				res, err := tr.ParseTo()
				So(err, ShouldBeNil)
				So(res, ShouldEqual, expected)
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
			So(res.UnixNano()/int64(time.Millisecond), ShouldEqual, int64(1474973725473))

			res, err = tr.ParseTo()
			So(err, ShouldBeNil)
			So(res.UnixNano()/int64(time.Millisecond), ShouldEqual, int64(1474975757930))
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
