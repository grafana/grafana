package tsdb

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
)

func TestIntervalCalculator_Calculate(t *testing.T) {
	calculator := NewIntervalCalculator(&IntervalOptions{})

	testCases := []struct {
		name      string
		timeRange *TimeRange
		expected  string
	}{
		{"from 5m to now", NewTimeRange("5m", "now"), "200ms"},
		{"from 15m to now", NewTimeRange("15m", "now"), "500ms"},
		{"from 30m to now", NewTimeRange("30m", "now"), "1s"},
		{"from 1h to now", NewTimeRange("1h", "now"), "2s"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			interval := calculator.Calculate(tc.timeRange, time.Millisecond*1)
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
