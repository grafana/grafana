package es

import (
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIndexPattern(t *testing.T) {
	t.Run("Static index patterns", func(t *testing.T) {
		indexPatternScenario(t, noInterval, "data-*", backend.TimeRange{}, func(indices []string) {
			require.Len(t, indices, 1)
			require.Equal(t, indices[0], "data-*")
		})

		indexPatternScenario(t, noInterval, "es-index-name", backend.TimeRange{}, func(indices []string) {
			require.Len(t, indices, 1)
			require.Equal(t, indices[0], "es-index-name")
		})
	})

	t.Run("Dynamic index patterns", func(t *testing.T) {
		from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
		to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
		timeRange := backend.TimeRange{
			From: from,
			To:   to,
		}

		indexPatternScenario(t, intervalHourly, "[data-]YYYY.MM.DD.HH", timeRange, func(indices []string) {
			require.Len(t, indices, 1)
			require.Equal(t, indices[0], "data-2018.05.15.17")
		})

		indexPatternScenario(t, intervalHourly, "YYYY.MM.DD.HH[-data]", timeRange, func(indices []string) {
			require.Len(t, indices, 1)
			require.Equal(t, indices[0], "2018.05.15.17-data")
		})

		indexPatternScenario(t, intervalDaily, "[data-]YYYY.MM.DD", timeRange, func(indices []string) {
			require.Len(t, indices, 1)
			require.Equal(t, indices[0], "data-2018.05.15")
		})

		indexPatternScenario(t, intervalDaily, "YYYY.MM.DD[-data]", timeRange, func(indices []string) {
			require.Len(t, indices, 1)
			require.Equal(t, indices[0], "2018.05.15-data")
		})

		indexPatternScenario(t, intervalWeekly, "[data-]GGGG.WW", timeRange, func(indices []string) {
			require.Len(t, indices, 1)
			require.Equal(t, indices[0], "data-2018.20")
		})

		indexPatternScenario(t, intervalWeekly, "GGGG.WW[-data]", timeRange, func(indices []string) {
			require.Len(t, indices, 1)
			require.Equal(t, indices[0], "2018.20-data")
		})

		indexPatternScenario(t, intervalMonthly, "[data-]YYYY.MM", timeRange, func(indices []string) {
			require.Len(t, indices, 1)
			require.Equal(t, indices[0], "data-2018.05")
		})

		indexPatternScenario(t, intervalMonthly, "YYYY.MM[-data]", timeRange, func(indices []string) {
			require.Len(t, indices, 1)
			require.Equal(t, indices[0], "2018.05-data")
		})

		indexPatternScenario(t, intervalYearly, "[data-]YYYY", timeRange, func(indices []string) {
			require.Len(t, indices, 1)
			require.Equal(t, indices[0], "data-2018")
		})

		indexPatternScenario(t, intervalYearly, "YYYY[-data]", timeRange, func(indices []string) {
			require.Len(t, indices, 1)
			require.Equal(t, indices[0], "2018-data")
		})

		indexPatternScenario(t, intervalDaily, "YYYY[-data-]MM.DD", timeRange, func(indices []string) {
			require.Len(t, indices, 1)
			require.Equal(t, indices[0], "2018-data-05.15")
		})

		indexPatternScenario(t, intervalDaily, "[data-]YYYY[-moredata-]MM.DD", timeRange, func(indices []string) {
			require.Len(t, indices, 1)
			require.Equal(t, indices[0], "data-2018-moredata-05.15")
		})

		indexPatternScenario(t, noInterval, "", timeRange, func(indices []string) {
			require.Len(t, indices, 0)
		})

		t.Run("Should return 01 week", func(t *testing.T) {
			from = time.Date(2018, 1, 15, 17, 50, 0, 0, time.UTC)
			to = time.Date(2018, 1, 15, 17, 55, 0, 0, time.UTC)
			timeRange := backend.TimeRange{
				From: from,
				To:   to,
			}
			indexPatternScenario(t, intervalWeekly, "[data-]GGGG.WW", timeRange, func(indices []string) {
				require.Len(t, indices, 1)
				require.Equal(t, indices[0], "data-2018.03")
			})
		})
	})

	t.Run("Dynamic index pattern with error", func(t *testing.T) {
		from := time.Date(2018, 5, 15, 17, 50, 0, 0, time.UTC)
		to := time.Date(2018, 5, 15, 17, 55, 0, 0, time.UTC)
		timeRange := backend.TimeRange{
			From: from,
			To:   to,
		}
		ip, err := NewIndexPattern(intervalHourly, "kibana-sample-data-logs")
		require.NoError(t, err)
		indices, err := ip.GetIndices(timeRange)
		assert.Equal(t, indices, []string{})
		require.Error(t, err)
		assert.Equal(t, err.Error(), "invalid index pattern kibana-sample-data-logs. Specify an index with a time pattern or select 'No pattern'")
	})

	t.Run("Hourly interval", func(t *testing.T) {
		t.Run("Should return 1 interval", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&hourlyInterval{}).Generate(from, to)
			require.Len(t, intervals, 1)
			require.Equal(t, intervals[0], time.Date(2018, 1, 1, 23, 0, 0, 0, time.UTC))
		})

		t.Run("Should return 2 intervals", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 2, 0, 6, 0, 0, time.UTC)
			intervals := (&hourlyInterval{}).Generate(from, to)
			require.Len(t, intervals, 2)
			require.Equal(t, intervals[0], time.Date(2018, 1, 1, 23, 0, 0, 0, time.UTC))
			require.Equal(t, intervals[1], time.Date(2018, 1, 2, 0, 0, 0, 0, time.UTC))
		})

		t.Run("Should return 10 intervals", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 2, 8, 6, 0, 0, time.UTC)
			intervals := (&hourlyInterval{}).Generate(from, to)
			require.Len(t, intervals, 10)
			require.Equal(t, intervals[0], time.Date(2018, 1, 1, 23, 0, 0, 0, time.UTC))
			require.Equal(t, intervals[4], time.Date(2018, 1, 2, 3, 0, 0, 0, time.UTC))
			require.Equal(t, intervals[9], time.Date(2018, 1, 2, 8, 0, 0, 0, time.UTC))
		})
	})

	t.Run("Daily interval", func(t *testing.T) {
		t.Run("Should return 1 day", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&dailyInterval{}).Generate(from, to)
			require.Len(t, intervals, 1)
			require.Equal(t, intervals[0], time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
		})

		t.Run("Should return 2 days", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 2, 0, 6, 0, 0, time.UTC)
			intervals := (&dailyInterval{}).Generate(from, to)
			require.Len(t, intervals, 2)
			require.Equal(t, intervals[0], time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
			require.Equal(t, intervals[1], time.Date(2018, 1, 2, 0, 0, 0, 0, time.UTC))
		})

		t.Run("Should return 32 days", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 2, 1, 8, 6, 0, 0, time.UTC)
			intervals := (&dailyInterval{}).Generate(from, to)
			require.Len(t, intervals, 32)
			require.Equal(t, intervals[0], time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
			require.Equal(t, intervals[30], time.Date(2018, 1, 31, 0, 0, 0, 0, time.UTC))
			require.Equal(t, intervals[31], time.Date(2018, 2, 1, 0, 0, 0, 0, time.UTC))
		})
	})

	t.Run("Weekly interval", func(t *testing.T) {
		t.Run("Should return 1 week (1)", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			require.Len(t, intervals, 1)
			require.Equal(t, intervals[0], time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
		})

		t.Run("Should return 1 week (2)", func(t *testing.T) {
			from := time.Date(2017, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2017, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			require.Len(t, intervals, 1)
			require.Equal(t, intervals[0], time.Date(2016, 12, 26, 0, 0, 0, 0, time.UTC))
		})

		t.Run("Should return 2 weeks (1)", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 10, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			require.Len(t, intervals, 2)
			require.Equal(t, intervals[0], time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
			require.Equal(t, intervals[1], time.Date(2018, 1, 8, 0, 0, 0, 0, time.UTC))
		})

		t.Run("Should return 2 weeks (2)", func(t *testing.T) {
			from := time.Date(2017, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2017, 1, 8, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			require.Len(t, intervals, 2)
			require.Equal(t, intervals[0], time.Date(2016, 12, 26, 0, 0, 0, 0, time.UTC))
			require.Equal(t, intervals[1], time.Date(2017, 1, 2, 0, 0, 0, 0, time.UTC))
		})

		t.Run("Should return 3 weeks (1)", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 21, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			require.Len(t, intervals, 3)
			require.Equal(t, intervals[0], time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
			require.Equal(t, intervals[1], time.Date(2018, 1, 8, 0, 0, 0, 0, time.UTC))
			require.Equal(t, intervals[2], time.Date(2018, 1, 15, 0, 0, 0, 0, time.UTC))
		})

		t.Run("Should return 3 weeks (2)", func(t *testing.T) {
			from := time.Date(2017, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2017, 1, 9, 23, 6, 0, 0, time.UTC)
			intervals := (&weeklyInterval{}).Generate(from, to)
			require.Len(t, intervals, 3)
			require.Equal(t, intervals[0], time.Date(2016, 12, 26, 0, 0, 0, 0, time.UTC))
			require.Equal(t, intervals[1], time.Date(2017, 1, 2, 0, 0, 0, 0, time.UTC))
			require.Equal(t, intervals[2], time.Date(2017, 1, 9, 0, 0, 0, 0, time.UTC))
		})
	})

	t.Run("Monthly interval", func(t *testing.T) {
		t.Run("Should return 1 month", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 1, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&monthlyInterval{}).Generate(from, to)
			require.Len(t, intervals, 1)
			require.Equal(t, intervals[0], time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
		})

		t.Run("Should return 2 months", func(t *testing.T) {
			from := time.Date(2018, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 2, 2, 0, 6, 0, 0, time.UTC)
			intervals := (&monthlyInterval{}).Generate(from, to)
			require.Len(t, intervals, 2)
			require.Equal(t, intervals[0], time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
			require.Equal(t, intervals[1], time.Date(2018, 2, 1, 0, 0, 0, 0, time.UTC))
		})

		t.Run("Should return 14 months", func(t *testing.T) {
			from := time.Date(2017, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 2, 1, 8, 6, 0, 0, time.UTC)
			intervals := (&monthlyInterval{}).Generate(from, to)
			require.Len(t, intervals, 14)
			require.Equal(t, intervals[0], time.Date(2017, 1, 1, 0, 0, 0, 0, time.UTC))
			require.Equal(t, intervals[13], time.Date(2018, 2, 1, 0, 0, 0, 0, time.UTC))
		})
	})

	t.Run("Yearly interval", func(t *testing.T) {
		t.Run("Should return 1 year (hour diff)", func(t *testing.T) {
			from := time.Date(2018, 2, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 2, 1, 23, 6, 0, 0, time.UTC)
			intervals := (&yearlyInterval{}).Generate(from, to)
			require.Len(t, intervals, 1)
			require.Equal(t, intervals[0], time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
		})

		t.Run("Should return 1 year (month diff)", func(t *testing.T) {
			from := time.Date(2018, 2, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 12, 31, 23, 59, 59, 0, time.UTC)
			intervals := (&yearlyInterval{}).Generate(from, to)
			require.Len(t, intervals, 1)
			require.Equal(t, intervals[0], time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
		})

		t.Run("Should return 2 years", func(t *testing.T) {
			from := time.Date(2018, 2, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2019, 1, 1, 23, 59, 59, 0, time.UTC)
			intervals := (&yearlyInterval{}).Generate(from, to)
			require.Len(t, intervals, 2)
			require.Equal(t, intervals[0], time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
			require.Equal(t, intervals[1], time.Date(2019, 1, 1, 0, 0, 0, 0, time.UTC))
		})

		t.Run("Should return 5 years", func(t *testing.T) {
			from := time.Date(2014, 1, 1, 23, 1, 1, 0, time.UTC)
			to := time.Date(2018, 11, 1, 23, 59, 59, 0, time.UTC)
			intervals := (&yearlyInterval{}).Generate(from, to)
			require.Len(t, intervals, 5)
			require.Equal(t, intervals[0], time.Date(2014, 1, 1, 0, 0, 0, 0, time.UTC))
			require.Equal(t, intervals[4], time.Date(2018, 1, 1, 0, 0, 0, 0, time.UTC))
		})
	})
}

func indexPatternScenario(t *testing.T, interval string, pattern string, timeRange backend.TimeRange, fn func(indices []string)) {
	testName := fmt.Sprintf("Index pattern (interval=%s, index=%s", interval, pattern)
	t.Run(testName, func(t *testing.T) {
		ip, err := NewIndexPattern(interval, pattern)
		require.NoError(t, err)
		require.NotNil(t, ip)
		indices, err := ip.GetIndices(timeRange)
		require.NoError(t, err)
		fn(indices)
	})
}
