package tsdb

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/assert"
)

func TestIntervalCalculator_Calculate(t *testing.T) {
	calculator := NewCalculator(CalculatorOptions{})

	timeNow := time.Now()

	testCases := []struct {
		name      string
		timeRange backend.TimeRange
		expected  string
	}{
		{"from 5m to now", backend.TimeRange{From: timeNow, To: timeNow.Add(5 * time.Minute)}, "200ms"},
		{"from 15m to now", backend.TimeRange{From: timeNow, To: timeNow.Add(15 * time.Minute)}, "500ms"},
		{"from 30m to now", backend.TimeRange{From: timeNow, To: timeNow.Add(30 * time.Minute)}, "1s"},
		{"from 1h to now", backend.TimeRange{From: timeNow, To: timeNow.Add(60 * time.Minute)}, "2s"},
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
		queryInterval   string
		queryIntervalMs int64
		defaultInterval time.Duration
		expected        time.Duration
	}{
		{"45s", nil, "45s", 0, time.Second * 15, time.Second * 45},
		{"45", nil, "45", 0, time.Second * 15, time.Second * 45},
		{"2m", nil, "2m", 0, time.Second * 15, time.Minute * 2},
		{"intervalMs", nil, "", 45000, time.Second * 15, time.Second * 45},
		{"intervalMs sub-seconds", nil, "", 45200, time.Second * 15, time.Millisecond * 45200},
		{"defaultInterval when interval empty", nil, "", 0, time.Second * 15, time.Second * 15},
		{"defaultInterval when intervalMs 0", nil, "", 0, time.Second * 15, time.Second * 15},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			actual, err := GetIntervalFrom(tc.queryInterval, "", tc.queryIntervalMs, tc.defaultInterval)
			assert.Nil(t, err)
			assert.Equal(t, tc.expected, actual)
		})
	}
}
