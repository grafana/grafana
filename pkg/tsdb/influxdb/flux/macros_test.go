package flux

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
)

func TestInterpolate(t *testing.T) {
	timeRange := backend.TimeRange{
		From: time.Unix(1632305571, 310985041),
		To:   time.Unix(1632309171, 310985042),
	}

	options := queryOptions{
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
			before: `v.timeRangeStart, v.timeRangeStop, v.bucket, v.defaultBucket, v.organization, v.windowPeriod, a91{}.bucket, $__interval, $__interval_ms`,
			after:  `2021-09-22T10:12:51.310985041Z, 2021-09-22T11:12:51.310985042Z, "grafana2", "grafana3", "grafana1", 1m1.258s, a91{}.bucket, 1m, 61258`,
		},
		{
			name:   "don't interpolate bucket variable in join query",
			before: `range(start: v.timeRangeStart, stop: v.timeRangeStop) join.left(left: left |> group(), right: right,on:((l,r) => v.bucket == r.id), as: ((l, r) => ({l with name: r.name})))`,
			after:  `range(start: 2021-09-22T10:12:51.310985041Z, stop: 2021-09-22T11:12:51.310985042Z) join.left(left: left |> group(), right: right,on:((l,r) => v.bucket == r.id), as: ((l, r) => ({l with name: r.name})))`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query := queryModel{
				RawQuery:      tt.before,
				Options:       options,
				TimeRange:     timeRange,
				MaxDataPoints: 1,
				Interval:      61258 * 1000 * 1000,
			}
			interpolatedQuery := interpolate(query)
			diff := cmp.Diff(tt.after, interpolatedQuery)
			assert.Equal(t, "", diff)
		})
	}
}
