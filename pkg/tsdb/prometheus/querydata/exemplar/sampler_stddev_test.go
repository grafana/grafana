package exemplar_test

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"

	"github.com/grafana/grafana/pkg/tsdb/prometheus/models"
	"github.com/grafana/grafana/pkg/tsdb/prometheus/querydata/exemplar"
)

func TestStdDevSampler(t *testing.T) {
	sampler := exemplar.NewStandardDeviationSampler().(*exemplar.StandardDeviationSampler)
	t.Run("standard deviation sampler", func(t *testing.T) {
		tr := models.TimeRange{
			Start: time.Unix(0, 0),
			End:   time.Unix(100000, 0),
		}
		ex := generateTestExemplars(tr)
		sampler.SetStep(600 * time.Second)
		for i := 0; i < len(ex); i++ {
			sampler.Add(ex[i])
		}
		framer := exemplar.NewFramer(sampler, exemplar.NewLabelTracker())
		experimental.CheckGoldenJSONFramer(t, "testdata", "stddev_sampler", framer, update)
	})
}
