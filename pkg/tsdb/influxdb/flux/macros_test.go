package flux

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func TestInterpolate(t *testing.T) {
	// Unix sec: 1500376552
	// Unix ms:  1500376552001

	timeRange := backend.TimeRange{
		From: time.Unix(0, 0),
		To:   time.Unix(0, 0),
	}

	options := QueryOptions{
		Organization:  "grafana1",
		Bucket:        "grafana2",
		DefaultBucket: "grafana3",
	}

	tests := []struct {
		name   string
		before string
		after  string
	}{
		{
			name:   "interpolate flux variables",
			before: `v.timeRangeStart, something.timeRangeStop, XYZ.bucket, uuUUu.defaultBucket, aBcDefG.organization, window.windowPeriod, a91{}.bucket`,
			after:  `1970-01-01T00:00:00Z, 1970-01-01T00:00:00Z, "grafana2", "grafana3", "grafana1", 1s, a91{}.bucket`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {

			query := QueryModel{
				RawQuery:      tt.before,
				Options:       options,
				TimeRange:     timeRange,
				MaxDataPoints: 1,
				Interval:      1000 * 1000 * 1000,
			}
			interpolatedQuery, err := Interpolate(query)
			if err != nil {
				t.Fatal(err)
			}
			if diff := cmp.Diff(tt.after, interpolatedQuery); diff != "" {
				t.Fatalf("Result mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
