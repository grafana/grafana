package intervalv2

import (
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
