package api

import (
	"testing"
	"time"

	amconfig "github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// fullTimeIntervals returns a fully-populated set of time intervals exercising every field so
// the round-trip tests fail if any nested field is dropped.
func fullTimeIntervals() []timeinterval.TimeInterval {
	return []timeinterval.TimeInterval{
		{
			Times: []timeinterval.TimeRange{
				{StartMinute: 10, EndMinute: 20},
				{StartMinute: 50, EndMinute: 60},
			},
			Weekdays: []timeinterval.WeekdayRange{
				{InclusiveRange: timeinterval.InclusiveRange{Begin: 1, End: 2}},
				{InclusiveRange: timeinterval.InclusiveRange{Begin: 5, End: 6}},
			},
			DaysOfMonth: []timeinterval.DayOfMonthRange{
				{InclusiveRange: timeinterval.InclusiveRange{Begin: 1, End: 10}},
				{InclusiveRange: timeinterval.InclusiveRange{Begin: 20, End: 25}},
			},
			Months: []timeinterval.MonthRange{
				{InclusiveRange: timeinterval.InclusiveRange{Begin: 1, End: 3}},
			},
			Years: []timeinterval.YearRange{
				{InclusiveRange: timeinterval.InclusiveRange{Begin: 2020, End: 2022}},
			},
			Location: &timeinterval.Location{Location: time.UTC},
		},
	}
}

func TestMuteTimeIntervalModelRoundTrip(t *testing.T) {
	t.Run("roundtrip is lossless", func(t *testing.T) {
		cases := []struct {
			name string
			in   definitions.MuteTimeInterval
		}{
			{
				name: "fully populated",
				in: definitions.MuteTimeInterval{
					UID: "some-stable-uid",
					MuteTimeInterval: amconfig.MuteTimeInterval{
						Name:          "my-interval",
						TimeIntervals: fullTimeIntervals(),
					},
					Version:    "v-12345",
					Provenance: definitions.Provenance(models.ProvenanceAPI),
				},
			},
			{
				name: "zero value",
				in:   definitions.MuteTimeInterval{},
			},
			{
				name: "nil time intervals",
				in: definitions.MuteTimeInterval{
					MuteTimeInterval: amconfig.MuteTimeInterval{Name: "empty-interval"},
					Provenance:       definitions.Provenance(models.ProvenanceFile),
				},
			},
		}

		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				out := ModelToMuteTimeInterval(MuteTimeIntervalToModel(tc.in))
				require.Equal(t, tc.in, out)
			})
		}
	})
}
