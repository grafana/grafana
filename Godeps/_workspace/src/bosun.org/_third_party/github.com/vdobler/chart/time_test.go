package chart

import (
	"testing"
	"time"
)

func TestRoundDown(t *testing.T) {
	tf := "2006-01-02 15:04:05 MST"
	samples := []struct {
		date, expected string
		delta          TimeDelta
	}{
		// Simple cases
		{"2011-07-04 16:43:23 CEST", "2011-07-04 16:43:00 CEST", Minute{1}},
		{"2011-07-04 16:43:23 CEST", "2011-07-04 16:40:00 CEST", Minute{5}},
		{"2011-07-04 16:43:23 CEST", "2011-07-04 16:40:00 CEST", Minute{10}},
		{"2011-07-04 16:43:23 CEST", "2011-07-04 16:30:00 CEST", Minute{15}},
		{"2011-07-04 16:43:23 CEST", "2011-07-04 16:00:00 CEST", Hour{1}},
		{"2011-07-04 16:43:23 CEST", "2011-07-04 12:00:00 CEST", Hour{6}},

		// Around daylight saving switch
		{"2011-03-27 04:15:16 CEST", "2011-03-27 04:00:00 CEST", Hour{1}},
		{"2011-03-27 04:15:16 CEST", "2011-03-27 00:00:00 CET", Hour{5}},

		{"2011-07-04 16:43:23 CEST", "2011-01-01 00:00:00 CET", Year{1}},
		{"2011-07-04 16:43:23 CEST", "2010-01-01 00:00:00 CET", Year{10}},
	}

	for k, sample := range samples {
		date, e1 := time.Parse(tf, sample.date)
		expected, e2 := time.Parse(tf, sample.expected)
		if e1 != nil || e2 != nil {
			t.Fatalf("Unexpected error(s): %v %v", e1, e2)
		}
		date = date.Local()
		expected = expected.Local()
		date = sample.delta.RoundDown(date)
		if date.Unix() != expected.Unix() {
			t.Errorf("%d. RoundDown %s to %s != %s, was %s", k,
				sample.date, sample.delta,
				sample.expected, date.Format(tf))
		}
	}

}
