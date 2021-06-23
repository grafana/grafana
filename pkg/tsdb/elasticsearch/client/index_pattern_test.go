package es

import (
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/stretchr/testify/require"
)

func TestIndexPattern(t *testing.T) {
	t.Run("Static index patterns", func(t *testing.T) {
		indexPatternScenario(noInterval, "data-*", plugins.DataTimeRange{}, func(indices []string) {
			require.Equal(t, 1, len(indices))
			require.Equal(t, "data-*", indices[0])
		})

		indexPatternScenario(noInterval, "es-index-name", plugins.DataTimeRange{}, func(indices []string) {
			require.Equal(t, 1, len(indices))
			require.Equal(t, "es-index-name", indices[0])
		})
	})

	t.Run("Dynamic index patterns", func(t *testing.T) {
		from := fmt.Sprintf("%d", time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC).UnixNano()/int64(time.Millisecond))
		to := fmt.Sprintf("%d", time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC).UnixNano()/int64(time.Millisecond))

		indexPatternScenario(intervalHourly, "[data-]YYYY.MM.DD.HH", plugins.NewDataTimeRange(from, to), func(indices []string) {
			require.Equal(t, 1, len(indices))
			require.Equal(t, "data-2018.05.15.17", indices[0])
		})

		indexPatternScenario(intervalHourly, "YYYY.MM.DD.HH[-data]", plugins.NewDataTimeRange(from, to), func(indices []string) {
			require.Equal(t, 1, len(indices))
			require.Equal(t, "2018.05.15.17-data", indices[0])
		})

		indexPatternScenario(intervalDaily, "[data-]YYYY.MM.DD", plugins.NewDataTimeRange(from, to), func(indices []string) {
			require.Equal(t, 1, len(indices))
			require.Equal(t, "data-2018.05.15", indices[0])
		})

		indexPatternScenario(intervalDaily, "YYYY.MM.DD[-data]", plugins.NewDataTimeRange(from, to), func(indices []string) {
			require.Equal(t, 1, len(indices))
			require.Equal(t, "2018.05.15-data", indices[0])
		})

		indexPatternScenario(intervalWeekly, "[data-]GGGG.WW", plugins.NewDataTimeRange(from, to), func(indices []string) {
			require.Equal(t, 1, len(indices))
			require.Equal(t, "data-2018.20", indices[0])
		})

		indexPatternScenario(intervalWeekly, "GGGG.WW[-data]", plugins.NewDataTimeRange(from, to), func(indices []string) {
			require.Equal(t, 1, len(indices))
			require.Equal(t, "2018.20-data", indices[0])
		})

		indexPatternScenario(intervalMonthly, "[data-]YYYY.MM", plugins.NewDataTimeRange(from, to), func(indices []string) {
			require.Equal(t, 1, len(indices))
			require.Equal(t, "data-2018.05", indices[0])
		})

		indexPatternScenario(intervalMonthly, "YYYY.MM[-data]", plugins.NewDataTimeRange(from, to), func(indices []string) {
			require.Equal(t, 1, len(indices))
			require.Equal(t, "2018.05-data", indices[0])
		})

		indexPatternScenario(intervalYearly, "[data-]YYYY", plugins.NewDataTimeRange(from, to), func(indices []string) {
			require.Equal(t, 1, len(indices))
			require.Equal(t, "data-2018", indices[0])
		})

		indexPatternScenario(intervalYearly, "YYYY[-data]", plugins.NewDataTimeRange(from, to), func(indices []string) {
			require.Equal(t, 1, len(indices))
			require.Equal(t, "2018-data", indices[0])
		})

		indexPatternScenario(intervalDaily, "YYYY[-data-]MM.DD", plugins.NewDataTimeRange(from, to), func(indices []string) {
			require.Equal(t, 1, len(indices))
			require.Equal(t, "2018-data-05.15", indices[0])
		})

		indexPatternScenario(intervalDaily, "[data-]YYYY[-moredata-]MM.DD", plugins.NewDataTimeRange(from, to), func(indices []string) {
			require.Equal(t, 1, len(indices))
			require.Equal(t, "data-2018-moredata-05.15", indices[0])
		})

		t.Run("Should return 01 week", func(t *testing.T) {
			from = fmt.Sprintf("%d", time.Date(2018, 1, 15, 17, 50, 0, 0, time.UTC).UnixNano()/int64(time.Millisecond))
			to = fmt.Sprintf("%d", time.Date(2018, 1, 15, 17, 55, 0, 0, time.UTC).UnixNano()/int64(time.Millisecond))
			indexPatternScenario(intervalWeekly, "[data-]GGGG.WW", plugins.NewDataTimeRange(from, to), func(indices []string) {
				require.Equal(t, 1, len(indices))
				require.Equal(t, "data-2018.03", indices[0])
			})
		})
	})

	t.Run("Hourly interval", func(t *testing.T) {
		t.Run("Should return 1 interval", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&hourlyInterval{}).Generate(from, to)
			require.Equal(t, 1, len(intervals))
			require.Equal(t, time.Date(2018, 1, 1, 23, 0, 0, 0, time.UTC), intervals[0])
		})

		t.Run("Should return 2 intervals", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 2, 0, 6, 0, 0, time.UTC)
			intervals := (&hourlyInterval{}).Generate(from, to)
			require.Equal(t, 2, len(intervals))
			require.Equal(t, time.Date(2018, 1, 1, 23, 0, 0, 0, time.UTC), intervals[0])
			require.Equal(t, time.Date(2018, 1, 2, 0, 0, 0, 0, time.UTC), intervals[1])
		})

		t.Run("Should return 10 intervals", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 2, 8, 6, 0, 0, time.UTC)
			intervals := (&hourlyInterval{}).Generate(from, to)
			require.Equal(t, 10, len(intervals))
			require.Equal(t, time.Date(2018, 1, 1, 23, 0, 0, 0, time.UTC), intervals[0])
			require.Equal(t, time.Date(2018, 1, 2, 3, 0, 0, 0, time.UTC), intervals[4])
			require.Equal(t, time.Date(2018, 1, 2, 8, 0, 0, 0, time.UTC), intervals[9])
		})
	})

	t.Run("Daily interval", func(t *testing.T) {
		t.Run("Should return 1 day", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&dailyInterval{}).Generate(from, to)
			require.Equal(t, 1, len(intervals))
			require.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
		})

		t.Run("Should return 2 days", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 2, 0, 6, 0, 0, time.UTC)
			intervals := (&dailyInterval{}).Generate(from, to)
			require.Equal(t, 2, len(intervals))
			require.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
			require.Equal(t, time.Date(2018, 1, 2, 0, 0, 0, 0, time.UTC), intervals[1])
		})

		t.Run("Should return 32 days", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 2, 1, 8, 6, 0, 0, time.UTC)
			intervals := (&dailyInterval{}).Generate(from, to)
			require.Equal(t, 32, len(intervals))
			require.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
			require.Equal(t, time.Date(2018, 1, 31, 0, 0, 0, 0, time.UTC), intervals[30])
			require.Equal(t, time.Date(2018, 2, 1, 0, 0, 0, 0, time.UTC), intervals[31])
		})
	})

	t.Run("Weekly interval", func(t *testing.T) {
		t.Run("Should return 1 week (1)", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			require.Equal(t, 1, len(intervals))
			require.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
		})

		t.Run("Should return 1 week (2)", func(t *testing.T) {
			from := time.Date(2017, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2017, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			require.Equal(t, 1, len(intervals))
			require.Equal(t, time.Date(2016, 12, 26, 0, 0, 0, 0, time.UTC), intervals[0])
		})

		t.Run("Should return 2 weeks (1)", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 10, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			require.Equal(t, 2, len(intervals))
			require.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
			require.Equal(t, time.Date(2018, 1, 8, 0, 0, 0, 0, time.UTC), intervals[1])
		})

		t.Run("Should return 2 weeks (2)", func(t *testing.T) {
			from := time.Date(2017, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2017, 1, 8, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			require.Equal(t, 2, len(intervals))
			require.Equal(t, time.Date(2016, 12, 26, 0, 0, 0, 0, time.UTC), intervals[0])
			require.Equal(t, time.Date(2017, 1, 2, 0, 0, 0, 0, time.UTC), intervals[1])
		})

		t.Run("Should return 3 weeks (1)", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 21, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			require.Equal(t, 3, len(intervals))
			require.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
			require.Equal(t, time.Date(2018, 1, 8, 0, 0, 0, 0, time.UTC), intervals[1])
			require.Equal(t, time.Date(2018, 1, 15, 0, 0, 0, 0, time.UTC), intervals[2])
		})

		t.Run("Should return 3 weeks (2)", func(t *testing.T) {
			from := time.Date(2017, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2017, 1, 9, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			require.Equal(t, 3, len(intervals))
			require.Equal(t, time.Date(2016, 12, 26, 0, 0, 0, 0, time.UTC), intervals[0])
			require.Equal(t, time.Date(2017, 1, 2, 0, 0, 0, 0, time.UTC), intervals[1])
			require.Equal(t, time.Date(2017, 1, 9, 0, 0, 0, 0, time.UTC), intervals[2])
		})
	})

	t.Run("Monthly interval", func(t *testing.T) {
		t.Run("Should return 1 month", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&monthlyInterval{}).Generate(from, to)
			require.Equal(t, 1, len(intervals))
			require.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
		})

		t.Run("Should return 2 months", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 2, 2, 0, 6, 0, 0, time.UTC)
			intervals := (&monthlyInterval{}).Generate(from, to)
			require.Equal(t, 2, len(intervals))
			require.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
			require.Equal(t, time.Date(2018, 2, 1, 0, 0, 0, 0, time.UTC), intervals[1])
		})

		t.Run("Should return 14 months", func(t *testing.T) {
			from := time.Date(2017, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 2, 1, 8, 6, 0, 0, time.UTC)
			intervals := (&monthlyInterval{}).Generate(from, to)
			require.Equal(t, 14, len(intervals))
			require.Equal(t, time.Date(2017, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
			require.Equal(t, time.Date(2018, 2, 1, 0, 0, 0, 0, time.UTC), intervals[13])
		})
	})

	t.Run("Yearly interval", func(t *testing.T) {
		t.Run("Should return 1 year (hour diff)", func(t *testing.T) {
			from := time.Date(2018, 2, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 2, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&yearlyInterval{}).Generate(from, to)
			require.Equal(t, 1, len(intervals))
			require.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
		})

		t.Run("Should return 1 year (month diff)", func(t *testing.T) {
			from := time.Date(2018, 2, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 12, 31, 23, 59, 59, 0, time.UTC)
			intervals := (&yearlyInterval{}).Generate(from, to)
			require.Equal(t, 1, len(intervals))
			require.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
		})

		t.Run("Should return 2 years", func(t *testing.T) {
			from := time.Date(2018, 2, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2019, 1, 1, 23, 59, 59, 0, time.UTC)
			intervals := (&yearlyInterval{}).Generate(from, to)
			require.Equal(t, 2, len(intervals))
			require.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
			require.Equal(t, time.Date(2019, 1, 1, 0, 0, 0, 0, time.UTC), intervals[1])
		})

		t.Run("Should return 5 years", func(t *testing.T) {
			from := time.Date(2014, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 11, 1, 23, 59, 59, 0, time.UTC)
			intervals := (&yearlyInterval{}).Generate(from, to)
			require.Equal(t, 5, intervals)
			require.Equal(t, time.Date(2014, 1, 1, 0, 0, 0, 0, time.UTC), intervals[0])
			require.Equal(t, time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC), intervals[4])
		})
	})
}

func indexPatternScenario(interval string, pattern string, timeRange plugins.DataTimeRange, fn func(indices []string)) {
	Convey(fmt.Sprintf("Index pattern (interval=%s, index=%s", interval, pattern), func() {
		ip, err := newIndexPattern(interval, pattern)
		require.NoError(t, err)
		require.NotNil(t, ip)
		indices, err := ip.GetIndices(timeRange)
		require.NoError(t, err)
		fn(indices)
	})
}
