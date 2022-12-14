package exemplar_test

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/models"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/querydata/exemplar"
)

const update = true

func TestUniformSampler(t *testing.T) {
	sampler := exemplar.NewUniformSampler(exemplar.UNIFORM_SAMPLER_X_COUNT, exemplar.UNIFORM_SAMPLER_Y_COUNT).(*exemplar.UniformSampler)
	t.Run("uniform sampler", func(t *testing.T) {
		tr := models.TimeRange{
			Start: time.Unix(0, 0),
			End:   time.Unix(100000, 0),
		}
		ex := generateTestExemplars(tr)
		step := sampler.CalculateStep(tr)
		sampler.SetStep(step)
		for i := 0; i < len(ex); i++ {
			sampler.Add(ex[i])
		}
		framer := exemplar.NewFramer(sampler, exemplar.NewLabelTracker())
		experimental.CheckGoldenJSONFramer(t, "testdata", "uniform_sampler", framer, update)
	})
}
