package interval

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

func TestIntervalCalculator_Calculate(t *testing.T) {
	calculator := NewCalculator(CalculatorOptions{})

	testCases := []struct {
		name      string
		timeRange legacydata.DataTimeRange
		expected  string
	}{
		{"from 5m to now", legacydata.NewDataTimeRange("5m", "now"), "200ms"},
		{"from 15m to now", legacydata.NewDataTimeRange("15m", "now"), "500ms"},
		{"from 30m to now", legacydata.NewDataTimeRange("30m", "now"), "1s"},
		{"from 1h to now", legacydata.NewDataTimeRange("1h", "now"), "2s"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			interval := calculator.Calculate(tc.timeRange, time.Millisecond*1)
			assert.Equal(t, tc.expected, interval.Text)
		})
	}
}

func TestIntervalCalculator_CalculateSafeInterval(t *testing.T) {
	calculator := NewCalculator(CalculatorOptions{})

	testCases := []struct {
		name           string
		timeRange      legacydata.DataTimeRange
		safeResolution int64
		expected       string
	}{
		{"from 5m to now", legacydata.NewDataTimeRange("5m", "now"), 11000, "20ms"},
		{"from 15m to now", legacydata.NewDataTimeRange("15m", "now"), 11000, "100ms"},
		{"from 30m to now", legacydata.NewDataTimeRange("30m", "now"), 11000, "200ms"},
		{"from 24h to now", legacydata.NewDataTimeRange("24h", "now"), 11000, "10s"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			interval := calculator.CalculateSafeInterval(tc.timeRange, tc.safeResolution)
			assert.Equal(t, tc.expected, interval.Text)
		})
	}
}

func TestRoundInterval(t *testing.T) {
	testCases := []struct {
		name     string
		interval time.Duration
		expected time.Duration
	}{
		{"30ms", time.Millisecond * 30, time.Millisecond * 20},
		{"45ms", time.Millisecond * 45, time.Millisecond * 50},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, roundInterval(tc.interval))
		})
	}
}

func TestFormatDuration(t *testing.T) {
	testCases := []struct {
		name     string
		duration time.Duration
		expected string
	}{
		{"61s", time.Second * 61, "1m"},
		{"30ms", time.Millisecond * 30, "30ms"},
		{"23h", time.Hour * 23, "23h"},
		{"24h", time.Hour * 24, "1d"},
		{"367d", time.Hour * 24 * 367, "1y"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, FormatDuration(tc.duration))
		})
	}
}

func TestGetIntervalFrom(t *testing.T) {
	dsJSON, err := simplejson.NewJson([]byte(`{"timeInterval": "60s"}`))
	require.NoError(t, err)
	testCases := []struct {
		name            string
		dsInfo          *datasources.DataSource
		queryModel      string
		defaultInterval time.Duration
		expected        time.Duration
	}{
		{"45s", nil, `{"interval": "45s"}`, time.Second * 15, time.Second * 45},
		{"45", nil, `{"interval": "45"}`, time.Second * 15, time.Second * 45},
		{"2m", nil, `{"interval": "2m"}`, time.Second * 15, time.Minute * 2},
		{"intervalMs", nil, `{"intervalMs": 45000}`, time.Second * 15, time.Second * 45},
		{"intervalMs sub-seconds", nil, `{"intervalMs": 45200}`, time.Second * 15, time.Millisecond * 45200},
		{"dsInfo timeInterval", &datasources.DataSource{
			JsonData: dsJSON,
		}, `{}`, time.Second * 15, time.Second * 60},
		{"defaultInterval when interval empty", nil, `{"interval": ""}`, time.Second * 15, time.Second * 15},
		{"defaultInterval when intervalMs 0", nil, `{"intervalMs": 0}`, time.Second * 15, time.Second * 15},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			js, _ := simplejson.NewJson([]byte(tc.queryModel))
			actual, err := GetIntervalFrom(tc.dsInfo, js, tc.defaultInterval)
			assert.Nil(t, err)
			assert.Equal(t, tc.expected, actual)
		})
	}
}
