package sqleng

import (
	"github.com/grafana/grafana-plugin-sdk-go/data"
	rsmpl "github.com/grafana/grafana/pkg/tsdb/sqleng/resample"
)

func resample(f *data.Frame, qm dataQueryModel) (*data.Frame, error) {
	return rsmpl.Resample(f, qm.FillMissing, qm.TimeRange, qm.Interval)
}
