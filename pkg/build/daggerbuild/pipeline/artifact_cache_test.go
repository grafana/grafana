package pipeline_test

import (
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/build/daggerbuild/pipeline"
)

func RequireParse(t *testing.T, layout string, value string) time.Time {
	ts, err := time.ParseInLocation(layout, value, time.UTC)
	if err != nil {
		t.Fatal(err)
	}

	return ts
}

func TestNextInterval(t *testing.T) {
	type tc struct {
		Description string
		Ts          time.Time
		D           time.Duration
		Res         time.Time
	}

	tt := []tc{
		{
			Description: "Week duration",
			Ts:          RequireParse(t, time.RFC3339, "2000-02-04T09:00:00+00:00"),
			D:           time.Hour * 24 * 7,
			Res:         RequireParse(t, time.RFC3339, "2000-02-10T00:00:00+00:00"),
		},
		{
			Description: "Week duration",
			Ts:          RequireParse(t, time.RFC3339, "2000-02-11T09:00:00+00:00"),
			D:           time.Hour * 24 * 7,
			Res:         RequireParse(t, time.RFC3339, "2000-02-17T00:00:00+00:00"),
		},
		{
			Description: "2 Week duration",
			Ts:          RequireParse(t, time.RFC3339, "2000-02-04T09:00:00+00:00"),
			D:           (time.Hour * 24 * 7) * 2,
			Res:         RequireParse(t, time.RFC3339, "2000-02-17T00:00:00+00:00"),
		},
		{
			Description: "2 day duration",
			Ts:          RequireParse(t, time.RFC3339, "2000-02-04T09:00:00+00:00"),
			D:           (time.Hour * 24 * 2),
			Res:         RequireParse(t, time.RFC3339, "2000-02-05T00:00:00+00:00"),
		},
	}

	for i, v := range tt {
		t.Run(fmt.Sprintf("[%d/%d] %s", i+1, len(tt), v.Description), func(t *testing.T) {
			n := pipeline.NextInterval(v.Ts, v.D)
			if !n.Equal(v.Res) {
				t.Fatalf("%s != %s", n.Format(time.RFC3339), v.Res.Format(time.RFC3339))
			}
		})
	}
}
