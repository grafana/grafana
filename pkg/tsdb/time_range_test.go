package tsdb

import (
	"strconv"
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
				fiveMinAgo, err := time.ParseDuration("-5m")
				So(err, ShouldBeNil)
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
				fiveHourAgo, err := time.ParseDuration("-5h")
				So(err, ShouldBeNil)
				expected := now.Add(fiveHourAgo)

				res, err := tr.ParseFrom()
				So(err, ShouldBeNil)
				So(res.Unix(), ShouldEqual, expected.Unix())
			})

			Convey("now-10m ", func() {
				tenMinAgo, err := time.ParseDuration("-10m")
				So(err, ShouldBeNil)
				expected := now.Add(tenMinAgo)
				res, err := tr.ParseTo()
				So(err, ShouldBeNil)
				So(res.Unix(), ShouldEqual, expected.Unix())
			})
		})

		now, err := time.Parse(time.RFC3339Nano, "2020-03-26T15:12:56.000Z")
		So(err, ShouldBeNil)
		Convey("Can parse now-1M/M, now-1M/M", func() {
			tr := TimeRange{
				From: "now-1M/M",
				To:   "now-1M/M",
				now:  now,
			}

			Convey("from now-1M/M ", func() {
				expected, err := time.Parse(time.RFC3339Nano, "2020-02-01T00:00:00.000Z")
				So(err, ShouldBeNil)

				res, err := tr.ParseFrom()
				So(err, ShouldBeNil)
				So(res, ShouldEqual, expected)
			})

			Convey("to now-1M/M ", func() {
				expected, err := time.Parse(time.RFC3339Nano, "2020-02-29T23:59:59.999Z")
				So(err, ShouldBeNil)

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
				expected, err := time.Parse(time.RFC3339Nano, "2020-03-23T15:12:56.000Z")
				So(err, ShouldBeNil)

				res, err := tr.ParseFrom()
				So(err, ShouldBeNil)
				So(res, ShouldEqual, expected)
			})

			Convey("now+3w ", func() {
				expected, err := time.Parse(time.RFC3339Nano, "2020-04-16T15:12:56.000Z")
				So(err, ShouldBeNil)

				res, err := tr.ParseTo()
				So(err, ShouldBeNil)
				So(res, ShouldEqual, expected)
			})
		})

		Convey("Can parse 1960-02-01T07:00:00.000Z, 1965-02-03T08:00:00.000Z", func() {
			tr := TimeRange{
				From: "1960-02-01T07:00:00.000Z",
				To:   "1965-02-03T08:00:00.000Z",
				now:  now,
			}

			Convey("1960-02-01T07:00:00.000Z ", func() {
				expected, err := time.Parse(time.RFC3339Nano, "1960-02-01T07:00:00.000Z")
				So(err, ShouldBeNil)

				res, err := tr.ParseFrom()
				So(err, ShouldBeNil)
				So(res, ShouldEqual, expected)
			})

			Convey("1965-02-03T08:00:00.000Z ", func() {
				expected, err := time.Parse(time.RFC3339Nano, "1965-02-03T08:00:00.000Z")
				So(err, ShouldBeNil)

				res, err := tr.ParseTo()
				So(err, ShouldBeNil)
				So(res, ShouldEqual, expected)
			})
		})

		Convey("Can parse negative unix epochs", func() {
			from := time.Date(1960, 2, 1, 7, 0, 0, 0, time.UTC)
			to := time.Date(1965, 2, 3, 8, 0, 0, 0, time.UTC)
			tr := NewTimeRange(strconv.FormatInt(from.UnixNano()/int64(time.Millisecond), 10), strconv.FormatInt(to.UnixNano()/int64(time.Millisecond), 10))

			res, err := tr.ParseFrom()
			So(err, ShouldBeNil)
			So(res, ShouldEqual, from)

			res, err = tr.ParseTo()
			So(err, ShouldBeNil)
			So(res, ShouldEqual, to)
		})

		Convey("can parse unix epochs", func() {
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
