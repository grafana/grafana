package notifier

import (
	"testing"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/stretchr/testify/assert"

	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
)

func TestModelToTimeIntervals(t *testing.T) {
	weekdayRange := timeinterval.WeekdayRange{InclusiveRange: timeinterval.InclusiveRange{Begin: 1, End: 5}}

	ti := func(name string, intervals ...timeinterval.TimeInterval) v1.TimeInterval {
		return v1.TimeInterval{Title: name, TimeIntervals: intervals}
	}
	want := func(name string, intervals ...timeinterval.TimeInterval) config.TimeInterval {
		return config.TimeInterval{Name: name, TimeIntervals: intervals}
	}

	testCases := []struct {
		name     string
		in       []v1.TimeInterval
		expected []config.TimeInterval
	}{
		{
			name:     "empty",
			expected: []config.TimeInterval{},
		},
		{
			name:     "multiple time intervals",
			in:       []v1.TimeInterval{ti("ti-1"), ti("ti-2")},
			expected: []config.TimeInterval{want("ti-1"), want("ti-2")},
		},
		{
			name: "preserves TimeIntervals payload",
			in: []v1.TimeInterval{
				{Title: "ti-1", TimeIntervals: []timeinterval.TimeInterval{{Weekdays: []timeinterval.WeekdayRange{weekdayRange}}}},
			},
			expected: []config.TimeInterval{
				{Name: "ti-1", TimeIntervals: []timeinterval.TimeInterval{{Weekdays: []timeinterval.WeekdayRange{weekdayRange}}}},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := ModelToTimeIntervals(tc.in)
			assert.Equal(t, tc.expected, result)
		})
	}
}
