package interval

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIntervalCalculator_Calculate(t *testing.T) {
	calculator := NewCalculator(CalculatorOptions{})

	testCases := []struct {
		name         string
		timeRange    plugins.DataTimeRange
		intervalMode string
		expected     string
	}{
		{"from 5m to now", plugins.NewDataTimeRange("5m", "now"), "min", "200ms"},
		{"from 5m to now", plugins.NewDataTimeRange("5m", "now"), "exact", "1ms"},
		{"from 5m to now", plugins.NewDataTimeRange("5m", "now"), "max", "1ms"},
		{"from 15m to now", plugins.NewDataTimeRange("15m", "now"), "min", "500ms"},
		{"from 15m to now", plugins.NewDataTimeRange("15m", "now"), "max", "1ms"},
		{"from 15m to now", plugins.NewDataTimeRange("15m", "now"), "exact", "1ms"},
		{"from 30m to now", plugins.NewDataTimeRange("30m", "now"), "min", "1s"},
		{"from 30m to now", plugins.NewDataTimeRange("30m", "now"), "max", "1ms"},
		{"from 30m to now", plugins.NewDataTimeRange("30m", "now"), "exact", "1ms"},
		{"from 24h to now", plugins.NewDataTimeRange("24h", "now"), "min", "1m"},
		{"from 24h to now", plugins.NewDataTimeRange("24h", "now"), "max", "1ms"},
		{"from 24h to now", plugins.NewDataTimeRange("24h", "now"), "exact", "1ms"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			interval, err := calculator.Calculate(tc.timeRange, time.Millisecond*1, tc.intervalMode)
			require.Nil(t, err)
			assert.Equal(t, tc.expected, interval.Text)
		})
	}
}

func TestIntervalCalculator_CalculateSafeInterval(t *testing.T) {
	calculator := NewCalculator(CalculatorOptions{})

	testCases := []struct {
		name           string
		timeRange      plugins.DataTimeRange
		safeResolution int64
		expected       string
	}{
		{"from 5m to now", plugins.NewDataTimeRange("5m", "now"), 11000, "20ms"},
		{"from 15m to now", plugins.NewDataTimeRange("15m", "now"), 11000, "100ms"},
		{"from 30m to now", plugins.NewDataTimeRange("30m", "now"), 11000, "200ms"},
		{"from 24h to now", plugins.NewDataTimeRange("24h", "now"), 11000, "10s"},
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
		dsInfo          *models.DataSource
		queryModel      string
		defaultInterval time.Duration
		expected        time.Duration
	}{
		{"45s", nil, `{"interval": "45s"}`, time.Second * 15, time.Second * 45},
		{"45", nil, `{"interval": "45"}`, time.Second * 15, time.Second * 45},
		{"2m", nil, `{"interval": "2m"}`, time.Second * 15, time.Minute * 2},
		{"intervalMs", nil, `{"intervalMs": 45000}`, time.Second * 15, time.Second * 45},
		{"intervalMs sub-seconds", nil, `{"intervalMs": 45200}`, time.Second * 15, time.Millisecond * 45200},
		{"dsInfo timeInterval", &models.DataSource{
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
