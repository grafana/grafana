package intervalv2

import (
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
)

func TestIntervalCalculator_Calculate(t *testing.T) {
	calculator := NewCalculator(CalculatorOptions{})

	timeNow := time.Now()

	testCases := []struct {
		name       string
		timeRange  backend.TimeRange
		resolution int64
		expected   string
	}{
		{"from 5m to now and default resolution", backend.TimeRange{From: timeNow, To: timeNow.Add(5 * time.Minute)}, 0, "200ms"},
		{"from 5m to now and 500 resolution", backend.TimeRange{From: timeNow, To: timeNow.Add(5 * time.Minute)}, 500, "500ms"},
		{"from 15m to now and default resolution", backend.TimeRange{From: timeNow, To: timeNow.Add(15 * time.Minute)}, 0, "500ms"},
		{"from 15m to now and 100 resolution", backend.TimeRange{From: timeNow, To: timeNow.Add(15 * time.Minute)}, 100, "10s"},
		{"from 30m to now and default resolution", backend.TimeRange{From: timeNow, To: timeNow.Add(30 * time.Minute)}, 0, "1s"},
		{"from 30m to now and 3000 resolution", backend.TimeRange{From: timeNow, To: timeNow.Add(30 * time.Minute)}, 3000, "500ms"},
		{"from 1h to now and default resolution", backend.TimeRange{From: timeNow, To: timeNow.Add(time.Hour)}, 0, "2s"},
		{"from 1h to now and 1000 resolution", backend.TimeRange{From: timeNow, To: timeNow.Add(time.Hour)}, 1000, "5s"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			interval := calculator.Calculate(tc.timeRange, time.Millisecond*1, tc.resolution)
			assert.Equal(t, tc.expected, interval.Text)
		})
	}
}

func TestIntervalCalculator_CalculateSafeInterval(t *testing.T) {
	calculator := NewCalculator(CalculatorOptions{})

	timeNow := time.Now()

	testCases := []struct {
		name           string
		timeRange      backend.TimeRange
		safeResolution int64
		expected       string
	}{
		{"from 5m to now", backend.TimeRange{From: timeNow, To: timeNow.Add(5 * time.Minute)}, 11000, "20ms"},
		{"from 15m to now", backend.TimeRange{From: timeNow, To: timeNow.Add(15 * time.Minute)}, 11000, "100ms"},
		{"from 30m to now", backend.TimeRange{From: timeNow, To: timeNow.Add(30 * time.Minute)}, 11000, "200ms"},
		{"from 24h to now", backend.TimeRange{From: timeNow, To: timeNow.Add(1440 * time.Minute)}, 11000, "10s"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			interval := calculator.CalculateSafeInterval(tc.timeRange, tc.safeResolution)
			assert.Equal(t, tc.expected, interval.Text)
		})
	}
}

func TestRoundInterval(t *testing.T) {
	tcs := []struct {
		input    time.Duration
		expected time.Duration
	}{
		{input: 9 * time.Millisecond, expected: time.Millisecond * 1},
		{input: 14 * time.Millisecond, expected: time.Millisecond * 10},
		{input: 34 * time.Millisecond, expected: time.Millisecond * 20},
		{input: 74 * time.Millisecond, expected: time.Millisecond * 50},
		{input: 140 * time.Millisecond, expected: time.Millisecond * 100},
		{input: 320 * time.Millisecond, expected: time.Millisecond * 200},
		{input: 740 * time.Millisecond, expected: time.Millisecond * 500},
		{input: 1400 * time.Millisecond, expected: time.Millisecond * 1000},
		{input: 3200 * time.Millisecond, expected: time.Millisecond * 2000},
		{input: 7400 * time.Millisecond, expected: time.Millisecond * 5000},
		{input: 12400 * time.Millisecond, expected: time.Millisecond * 10000},
		{input: 17250 * time.Millisecond, expected: time.Millisecond * 15000},
		{input: 23000 * time.Millisecond, expected: time.Millisecond * 20000},
		{input: 42000 * time.Millisecond, expected: time.Millisecond * 30000},
		{input: 85000 * time.Millisecond, expected: time.Millisecond * 60000},
		{input: 200000 * time.Millisecond, expected: time.Millisecond * 120000},
		{input: 420000 * time.Millisecond, expected: time.Millisecond * 300000},
		{input: 720000 * time.Millisecond, expected: time.Millisecond * 600000},
		{input: 1000000 * time.Millisecond, expected: time.Millisecond * 900000},
		{input: 1250000 * time.Millisecond, expected: time.Millisecond * 1200000},
		{input: 2500000 * time.Millisecond, expected: time.Millisecond * 1800000},
		{input: 5200000 * time.Millisecond, expected: time.Millisecond * 3600000},
		{input: 8500000 * time.Millisecond, expected: time.Millisecond * 7200000},
		{input: 15000000 * time.Millisecond, expected: time.Millisecond * 10800000},
		{input: 30000000 * time.Millisecond, expected: time.Millisecond * 21600000},
		{input: 85000000 * time.Millisecond, expected: time.Millisecond * 43200000},
		{input: 150000000 * time.Millisecond, expected: time.Millisecond * 86400000},
		{input: 600000000 * time.Millisecond, expected: time.Millisecond * 86400000},
		{input: 1500000000 * time.Millisecond, expected: time.Millisecond * 604800000},
		{input: 3500000000 * time.Millisecond, expected: time.Millisecond * 2592000000},
		{input: 40000000000 * time.Millisecond, expected: time.Millisecond * 31536000000},
	}
	for i, tc := range tcs {
		t.Run(fmt.Sprintf("testcase %d", i), func(t *testing.T) {
			res := roundInterval(tc.input)
			assert.Equal(t, tc.expected, res, "input %q", tc.input)
		})
	}
}
