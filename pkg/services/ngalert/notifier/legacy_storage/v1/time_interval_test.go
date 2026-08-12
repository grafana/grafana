package v1

import (
	"reflect"
	"testing"
	"time"

	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func inclusive(begin, end int) timeinterval.InclusiveRange {
	return timeinterval.InclusiveRange{Begin: begin, End: end}
}

func TestTimeInterval_Validate(t *testing.T) {
	utc, err := time.LoadLocation("UTC")
	require.NoError(t, err)

	tt := []struct {
		name      string
		interval  TimeInterval
		expErrMsg string
	}{
		{
			name: "valid interval passes",
			interval: TimeInterval{
				Title: "business-hours",
				TimeIntervals: []timeinterval.TimeInterval{
					{
						Times:       []timeinterval.TimeRange{{StartMinute: 540, EndMinute: 1020}},
						Weekdays:    []timeinterval.WeekdayRange{{InclusiveRange: inclusive(1, 5)}},
						DaysOfMonth: []timeinterval.DayOfMonthRange{{InclusiveRange: inclusive(1, 15)}},
						Months:      []timeinterval.MonthRange{{InclusiveRange: inclusive(1, 6)}},
						Years:       []timeinterval.YearRange{{InclusiveRange: inclusive(2024, 2025)}},
						Location:    &timeinterval.Location{Location: utc},
					},
				},
			},
		},
		{
			name:     "interval without any time intervals passes",
			interval: TimeInterval{Title: "empty"},
		},
		{
			name: "interval with an empty time interval passes",
			interval: TimeInterval{
				Title:         "empty-element",
				TimeIntervals: []timeinterval.TimeInterval{{}},
			},
		},
		{
			name: "negative days of month are allowed",
			interval: TimeInterval{
				Title: "end-of-month",
				TimeIntervals: []timeinterval.TimeInterval{
					{DaysOfMonth: []timeinterval.DayOfMonthRange{{InclusiveRange: inclusive(-3, -1)}}},
				},
			},
		},
		{
			name: "end minute at end of day is allowed",
			interval: TimeInterval{
				Title: "until-midnight",
				TimeIntervals: []timeinterval.TimeInterval{
					{Times: []timeinterval.TimeRange{{StartMinute: 1020, EndMinute: 1440}}},
				},
			},
		},
		{
			name:      "fails when title is empty",
			interval:  TimeInterval{Title: ""},
			expErrMsg: "missing name in time interval",
		},
		{
			name: "fails when start time is not before end time",
			interval: TimeInterval{
				Title: "inverted-times",
				TimeIntervals: []timeinterval.TimeInterval{
					{Times: []timeinterval.TimeRange{{StartMinute: 1020, EndMinute: 540}}},
				},
			},
			expErrMsg: "start time cannot be equal or greater than end time",
		},
		{
			name: "fails when time range is zero valued",
			interval: TimeInterval{
				Title: "zero-times",
				TimeIntervals: []timeinterval.TimeInterval{
					{Times: []timeinterval.TimeRange{{}}},
				},
			},
			expErrMsg: "start time cannot be equal or greater than end time",
		},
		{
			name: "fails when end minute is beyond the end of the day",
			interval: TimeInterval{
				Title: "overflowing-times",
				TimeIntervals: []timeinterval.TimeInterval{
					{Times: []timeinterval.TimeRange{{StartMinute: 540, EndMinute: 1500}}},
				},
			},
			expErrMsg: "couldn't parse timestamp 25:00, invalid format",
		},
		{
			name: "fails when weekday is out of range",
			interval: TimeInterval{
				Title: "invalid-weekday",
				TimeIntervals: []timeinterval.TimeInterval{
					{Weekdays: []timeinterval.WeekdayRange{{InclusiveRange: inclusive(1, 9)}}},
				},
			},
			expErrMsg: "unable to convert 9 into weekday string",
		},
		{
			name: "fails when weekday range is inverted",
			interval: TimeInterval{
				Title: "inverted-weekdays",
				TimeIntervals: []timeinterval.TimeInterval{
					{Weekdays: []timeinterval.WeekdayRange{{InclusiveRange: inclusive(5, 1)}}},
				},
			},
			expErrMsg: "start day cannot be before end day",
		},
		{
			name: "fails when day of month is out of range",
			interval: TimeInterval{
				Title: "invalid-day-of-month",
				TimeIntervals: []timeinterval.TimeInterval{
					{DaysOfMonth: []timeinterval.DayOfMonthRange{{InclusiveRange: inclusive(1, 32)}}},
				},
			},
			expErrMsg: "32 is not a valid day of the month: out of range",
		},
		{
			name: "fails when day of month has negative start but positive end",
			interval: TimeInterval{
				Title: "mixed-day-of-month",
				TimeIntervals: []timeinterval.TimeInterval{
					{DaysOfMonth: []timeinterval.DayOfMonthRange{{InclusiveRange: inclusive(-5, 5)}}},
				},
			},
			expErrMsg: "end day must be negative if start day is negative",
		},
		{
			name: "allows when day of month has positive start but negative end",
			interval: TimeInterval{
				Title: "mixed-day-of-month",
				TimeIntervals: []timeinterval.TimeInterval{
					{DaysOfMonth: []timeinterval.DayOfMonthRange{{InclusiveRange: inclusive(5, -5)}}},
				},
			},
			expErrMsg: "",
		},
		{
			name: "fails when month range is inverted",
			interval: TimeInterval{
				Title: "inverted-months",
				TimeIntervals: []timeinterval.TimeInterval{
					{Months: []timeinterval.MonthRange{{InclusiveRange: inclusive(6, 1)}}},
				},
			},
			expErrMsg: "end month january is before start month june",
		},
		{
			name: "fails when year range is inverted",
			interval: TimeInterval{
				Title: "inverted-years",
				TimeIntervals: []timeinterval.TimeInterval{
					{Years: []timeinterval.YearRange{{InclusiveRange: inclusive(2025, 2024)}}},
				},
			},
			expErrMsg: "end year 2024 is before start year 2025",
		},
		{
			name: "fails when location is set but empty",
			interval: TimeInterval{
				Title: "empty-location",
				TimeIntervals: []timeinterval.TimeInterval{
					{Location: &timeinterval.Location{}},
				},
			},
			expErrMsg: "unable to convert nil location into string",
		},
	}

	for _, tc := range tt {
		t.Run(tc.name, func(t *testing.T) {
			gotErr := tc.interval.Validate()
			if tc.expErrMsg != "" {
				require.Error(t, gotErr)
				require.ErrorContains(t, gotErr, tc.expErrMsg)
			} else {
				require.NoError(t, gotErr)
			}
		})
	}

	t.Run("validation is idempotent", func(t *testing.T) {
		interval := TimeInterval{
			Title: "test",
			TimeIntervals: []timeinterval.TimeInterval{
				{
					Times:    []timeinterval.TimeRange{{StartMinute: 0, EndMinute: 1440}},
					Weekdays: []timeinterval.WeekdayRange{{InclusiveRange: inclusive(3, 3)}},
					Location: &timeinterval.Location{Location: utc},
				},
			},
		}

		require.NoError(t, interval.Validate())
		first := TimeIntervalFingerprint(interval)
		require.NoError(t, interval.Validate())
		assert.Equal(t, first, TimeIntervalFingerprint(interval))
	})
}

func TestTimeIntervalFingerprint(t *testing.T) {
	baseInterval := func() TimeInterval {
		return TimeInterval{
			ResourceMetadata: ResourceMetadata{
				UID:        TimeIntervalUID("business-hours"),
				Version:    "some-version",
				Provenance: models.ProvenanceAPI,
			},
			Title: "business-hours",
			TimeIntervals: []timeinterval.TimeInterval{
				{
					Times:       []timeinterval.TimeRange{{StartMinute: 540, EndMinute: 1020}},
					Weekdays:    []timeinterval.WeekdayRange{{InclusiveRange: inclusive(1, 5)}},
					DaysOfMonth: []timeinterval.DayOfMonthRange{{InclusiveRange: inclusive(1, 15)}},
					Months:      []timeinterval.MonthRange{{InclusiveRange: inclusive(1, 6)}},
					Years:       []timeinterval.YearRange{{InclusiveRange: inclusive(2024, 2025)}},
					Location:    &timeinterval.Location{Location: time.UTC},
				},
			},
		}
	}

	t.Run("stable across code changes", func(t *testing.T) {
		// If this is a valid fingerprint generation change, update the expected value.
		assert.Equal(t, "07f0771de266d6d4", TimeIntervalFingerprint(baseInterval()))
	})

	t.Run("stable across equal values", func(t *testing.T) {
		assert.Equal(t, TimeIntervalFingerprint(baseInterval()), TimeIntervalFingerprint(baseInterval()))
	})

	t.Run("stable for empty interval", func(t *testing.T) {
		assert.Equal(t, TimeIntervalFingerprint(TimeInterval{}), TimeIntervalFingerprint(TimeInterval{}))
	})

	t.Run("nil and empty time intervals are equal", func(t *testing.T) {
		nilIntervals := TimeInterval{Title: "test"}
		emptyIntervals := TimeInterval{Title: "test", TimeIntervals: []timeinterval.TimeInterval{}}
		assert.Equal(t, TimeIntervalFingerprint(nilIntervals), TimeIntervalFingerprint(emptyIntervals))
	})

	t.Run("stable across metadata modification", func(t *testing.T) {
		fingerprint := TimeIntervalFingerprint(baseInterval())

		metadataType := reflect.TypeOf(ResourceMetadata{})
		otherMetadata := reflect.ValueOf(ResourceMetadata{
			UID:        "some-other-uid",
			Version:    "some-other-version",
			Provenance: models.ProvenanceFile,
		})
		for i := 0; i < metadataType.NumField(); i++ {
			field := metadataType.Field(i).Name
			cp := baseInterval()

			vf := reflect.ValueOf(&cp.ResourceMetadata).Elem().Field(i)
			other := otherMetadata.Field(i)
			require.NotEqualf(t, other.Interface(), vf.Interface(),
				"ResourceMetadata field %s is the same as the original, test does not ensure stability across the field", field)
			vf.Set(other)

			assert.Equalf(t, fingerprint, TimeIntervalFingerprint(cp),
				"ResourceMetadata field %s should not be part of the fingerprint", field)
		}
	})

	t.Run("unstable across title modification", func(t *testing.T) {
		cp := baseInterval()
		cp.Title = "after-hours"
		assert.NotEqual(t, TimeIntervalFingerprint(baseInterval()), TimeIntervalFingerprint(cp))
	})

	t.Run("unstable across time interval field modification", func(t *testing.T) {
		fingerprint := TimeIntervalFingerprint(baseInterval())

		other := timeinterval.TimeInterval{
			Times:       []timeinterval.TimeRange{{StartMinute: 0, EndMinute: 300}},
			Weekdays:    []timeinterval.WeekdayRange{{InclusiveRange: inclusive(6, 6)}},
			DaysOfMonth: []timeinterval.DayOfMonthRange{{InclusiveRange: inclusive(20, 25)}},
			Months:      []timeinterval.MonthRange{{InclusiveRange: inclusive(9, 12)}},
			Years:       []timeinterval.YearRange{{InclusiveRange: inclusive(2030, 2031)}},
			Location:    &timeinterval.Location{Location: time.FixedZone("Test/Zone", 3600)},
		}
		otherValue := reflect.ValueOf(other)

		intervalType := reflect.TypeOf(timeinterval.TimeInterval{})
		for i := 0; i < intervalType.NumField(); i++ {
			field := intervalType.Field(i).Name
			cp := baseInterval()

			vf := reflect.ValueOf(&cp.TimeIntervals[0]).Elem().Field(i)
			otherField := otherValue.Field(i)
			require.NotEqualf(t, otherField.Interface(), vf.Interface(),
				"TimeInterval field %s is the same as the original, test does not ensure instability across the field", field)
			vf.Set(otherField)

			assert.NotEqualf(t, fingerprint, TimeIntervalFingerprint(cp),
				"TimeInterval field %s does not seem to be used in the fingerprint", field)
		}
	})

	t.Run("unstable across cleared location", func(t *testing.T) {
		cp := baseInterval()
		cp.TimeIntervals[0].Location = nil
		assert.NotEqual(t, TimeIntervalFingerprint(baseInterval()), TimeIntervalFingerprint(cp))
	})

	t.Run("unstable across added time interval", func(t *testing.T) {
		cp := baseInterval()
		cp.TimeIntervals = append(cp.TimeIntervals, timeinterval.TimeInterval{
			Times: []timeinterval.TimeRange{{StartMinute: 0, EndMinute: 60}},
		})
		assert.NotEqual(t, TimeIntervalFingerprint(baseInterval()), TimeIntervalFingerprint(cp))
	})

	t.Run("unstable across reordered time intervals", func(t *testing.T) {
		first := TimeInterval{
			Title: "test",
			TimeIntervals: []timeinterval.TimeInterval{
				{Times: []timeinterval.TimeRange{{StartMinute: 0, EndMinute: 60}}},
				{Months: []timeinterval.MonthRange{{InclusiveRange: inclusive(1, 2)}}},
			},
		}
		second := TimeInterval{
			Title:         "test",
			TimeIntervals: []timeinterval.TimeInterval{first.TimeIntervals[1], first.TimeIntervals[0]},
		}
		assert.NotEqual(t, TimeIntervalFingerprint(first), TimeIntervalFingerprint(second))
	})

	t.Run("unstable across reordered times within a time interval", func(t *testing.T) {
		first := TimeInterval{
			Title: "test",
			TimeIntervals: []timeinterval.TimeInterval{
				{Times: []timeinterval.TimeRange{{StartMinute: 0, EndMinute: 60}, {StartMinute: 600, EndMinute: 660}}},
			},
		}
		second := TimeInterval{
			Title: "test",
			TimeIntervals: []timeinterval.TimeInterval{
				{Times: []timeinterval.TimeRange{{StartMinute: 600, EndMinute: 660}, {StartMinute: 0, EndMinute: 60}}},
			},
		}
		assert.NotEqual(t, TimeIntervalFingerprint(first), TimeIntervalFingerprint(second))
	})

	t.Run("matches the version set by NewTimeInterval", func(t *testing.T) {
		base := baseInterval()
		created := NewTimeInterval(base.Title, base.TimeIntervals, models.ProvenanceNone)
		assert.Equal(t, TimeIntervalFingerprint(base), created.Version)
	})
}
