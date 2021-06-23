package tsdb

import (
	"strconv"
	"testing"

	"time"

	"github.com/stretchr/testify/require"
)

func TestTimeRange(t *testing.T) {
	t.Run("Time range", func(t *testing.T) {
		now := time.Now()

		t.Run("Can parse 5m, now", func(t *testing.T) {
			tr := TimeRange{
				From: "5m",
				To:   "now",
				now:  now,
			}

			t.Run("5m ago ", func(t *testing.T) {
				fiveMinAgo, err := time.ParseDuration("-5m")
				require.NoError(t, err)
				expected := now.Add(fiveMinAgo)

				res, err := tr.ParseFrom()
				require.NoError(t, err)
				require.Equal(t, expected.Unix(), res.Unix())
			})

			t.Run("now ", func(t *testing.T) {
				res, err := tr.ParseTo()
				require.NoError(t, err)
				require.Equal(t, now.Unix(), res.Unix())
			})
		})

		t.Run("Can parse 5h, now-10m", func(t *testing.T) {
			tr := TimeRange{
				From: "5h",
				To:   "now-10m",
				now:  now,
			}

			t.Run("5h ago ", func(t *testing.T) {
				fiveHourAgo, err := time.ParseDuration("-5h")
				require.NoError(t, err)
				expected := now.Add(fiveHourAgo)

				res, err := tr.ParseFrom()
				require.NoError(t, err)
				require.Equal(t, expected.Unix(), res.Unix())
			})

			t.Run("now-10m ", func(t *testing.T) {
				tenMinAgo, err := time.ParseDuration("-10m")
				require.NoError(t, err)
				expected := now.Add(tenMinAgo)
				res, err := tr.ParseTo()
				require.NoError(t, err)
				require.Equal(t, expected.Unix(), res.Unix())
			})
		})

		now, err := time.Parse(time.RFC3339Nano, "2020-03-26T15:12:56.000Z")
		require.NoError(t, err)
		t.Run("Can parse now-1M/M, now-1M/M", func(t *testing.T) {
			tr := TimeRange{
				From: "now-1M/M",
				To:   "now-1M/M",
				now:  now,
			}

			t.Run("from now-1M/M ", func(t *testing.T) {
				expected, err := time.Parse(time.RFC3339Nano, "2020-02-01T00:00:00.000Z")
				require.NoError(t, err)

				res, err := tr.ParseFrom()
				require.NoError(t, err)
				require.Equal(t, expected, res)
			})

			t.Run("to now-1M/M ", func(t *testing.T) {
				expected, err := time.Parse(time.RFC3339Nano, "2020-02-29T23:59:59.999Z")
				require.NoError(t, err)

				res, err := tr.ParseTo()
				require.NoError(t, err)
				require.Equal(t, expected, res)
			})
		})

		t.Run("Can parse now-3d, now+3w", func(t *testing.T) {
			tr := TimeRange{
				From: "now-3d",
				To:   "now+3w",
				now:  now,
			}

			t.Run("now-3d ", func(t *testing.T) {
				expected, err := time.Parse(time.RFC3339Nano, "2020-03-23T15:12:56.000Z")
				require.NoError(t, err)

				res, err := tr.ParseFrom()
				require.NoError(t, err)
				require.Equal(t, expected, res)
			})

			t.Run("now+3w ", func(t *testing.T) {
				expected, err := time.Parse(time.RFC3339Nano, "2020-04-16T15:12:56.000Z")
				require.NoError(t, err)

				res, err := tr.ParseTo()
				require.NoError(t, err)
				require.Equal(t, expected, res)
			})
		})

		t.Run("Can parse 1960-02-01T07:00:00.000Z, 1965-02-03T08:00:00.000Z", func(t *testing.T) {
			tr := TimeRange{
				From: "1960-02-01T07:00:00.000Z",
				To:   "1965-02-03T08:00:00.000Z",
				now:  now,
			}

			t.Run("1960-02-01T07:00:00.000Z ", func(t *testing.T) {
				expected, err := time.Parse(time.RFC3339Nano, "1960-02-01T07:00:00.000Z")
				require.NoError(t, err)

				res, err := tr.ParseFrom()
				require.NoError(t, err)
				require.Equal(t, expected, res)
			})

			t.Run("1965-02-03T08:00:00.000Z ", func(t *testing.T) {
				expected, err := time.Parse(time.RFC3339Nano, "1965-02-03T08:00:00.000Z")
				require.NoError(t, err)

				res, err := tr.ParseTo()
				require.NoError(t, err)
				require.Equal(t, expected, res)
			})
		})

		t.Run("Can parse negative unix epochs", func(t *testing.T) {
			from := time.Date(1960, 2, 1, 7, 0, 0, 0, time.UTC)
			to := time.Date(1965, 2, 3, 8, 0, 0, 0, time.UTC)
			tr := NewTimeRange(strconv.FormatInt(from.UnixNano()/int64(time.Millisecond), 10), strconv.FormatInt(to.UnixNano()/int64(time.Millisecond), 10))

			res, err := tr.ParseFrom()
			require.NoError(t, err)
			require.True(t, from.Equal(res))

			res, err = tr.ParseTo()
			require.NoError(t, err)
			require.True(t, to.Equal(res))
		})

		t.Run("can parse unix epochs", func(t *testing.T) {
			var err error
			tr := TimeRange{
				From: "1474973725473",
				To:   "1474975757930",
				now:  now,
			}

			res, err := tr.ParseFrom()
			require.NoError(t, err)
			require.Equal(t, int64(1474973725473), res.UnixNano()/int64(time.Millisecond))

			res, err = tr.ParseTo()
			require.NoError(t, err)
			require.Equal(t, int64(1474975757930), res.UnixNano()/int64(time.Millisecond))
		})

		t.Run("Cannot parse asdf", func(t *testing.T) {
			var err error
			tr := TimeRange{
				From: "asdf",
				To:   "asdf",
				now:  now,
			}

			_, err = tr.ParseFrom()
			require.NotNil(t, err)

			_, err = tr.ParseTo()
			require.Error(t, err)
		})

		now, err = time.Parse(time.RFC3339Nano, "2020-07-26T15:12:56.000Z")
		require.NoError(t, err)

		t.Run("Can parse now-1M/M, now-1M/M with America/Chicago timezone", func(t *testing.T) {
			tr := TimeRange{
				From: "now-1M/M",
				To:   "now-1M/M",
				now:  now,
			}
			location, err := time.LoadLocation("America/Chicago")
			require.NoError(t, err)

			t.Run("from now-1M/M ", func(t *testing.T) {
				expected, err := time.Parse(time.RFC3339Nano, "2020-06-01T00:00:00.000-05:00")
				require.NoError(t, err)

				res, err := tr.ParseFromWithLocation(location)
				require.NoError(t, err)
				require.True(t, expected.Equal(res))
			})

			t.Run("to now-1M/M ", func(t *testing.T) {
				expected, err := time.Parse(time.RFC3339Nano, "2020-06-30T23:59:59.999-05:00")
				require.NoError(t, err)

				res, err := tr.ParseToWithLocation(location)
				require.NoError(t, err)
				require.True(t, expected.Equal(res))
			})
		})

		t.Run("Can parse now-3h, now+2h with America/Chicago timezone", func(t *testing.T) {
			tr := TimeRange{
				From: "now-3h",
				To:   "now+2h",
				now:  now,
			}
			location, err := time.LoadLocation("America/Chicago")
			require.NoError(t, err)

			t.Run("now-3h ", func(t *testing.T) {
				expected, err := time.Parse(time.RFC3339Nano, "2020-07-26T07:12:56.000-05:00")
				require.NoError(t, err)

				res, err := tr.ParseFromWithLocation(location)
				require.NoError(t, err)
				require.True(t, expected.Equal(res))
			})

			t.Run("now+2h ", func(t *testing.T) {
				expected, err := time.Parse(time.RFC3339Nano, "2020-07-26T12:12:56.000-05:00")
				require.NoError(t, err)

				res, err := tr.ParseToWithLocation(location)
				require.NoError(t, err)
				require.True(t, expected.Equal(res))
			})
		})
	})
}
