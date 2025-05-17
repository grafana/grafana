package exemplar_test

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"

	"github.com/grafana/grafana/pkg/promlib/models"
	"github.com/grafana/grafana/pkg/promlib/querydata/exemplar"
)

const update = true

func TestNoOpSampler(t *testing.T) {
	sampler := exemplar.NewNoOpSampler().(*exemplar.NoOpSampler)
	t.Run("no-op sampler", func(t *testing.T) {
		tr := models.TimeRange{
			Start: time.Unix(0, 0),
			End:   time.Unix(2000, 0),
		}
		ex := generateTestExemplars(tr)
		for i := 0; i < len(ex); i++ {
			sampler.Add(ex[i])
		}
		framer := exemplar.NewFramer(sampler, exemplar.NewLabelTracker())
		experimental.CheckGoldenJSONFramer(t, "testdata", "noop_sampler", framer, update)
	})
}

func generateTestExemplars(tr models.TimeRange) []models.Exemplar {
	exemplars := []models.Exemplar{}
	next := tr.Start.UTC()
	for !next.Equal(tr.End) && !next.After(tr.End) {
		exemplars = append(exemplars, models.Exemplar{
			Timestamp: next,
			Value:     float64(next.Unix()),
		})
		next = next.Add(time.Second).UTC()
	}
	return exemplars
}
