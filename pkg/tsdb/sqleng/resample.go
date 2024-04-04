package sqleng

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	rsmpl "github.com/grafana/grafana/pkg/tsdb/sqleng/resample"
)

func resample(f *data.Frame, qm dataQueryModel) (*data.Frame, error) {
	// we align the start-time

	startUnixTime := qm.TimeRange.From.Unix() / int64(qm.Interval.Seconds()) * int64(qm.Interval.Seconds())
	startTime := time.Unix(startUnixTime, 0)
	alignedTimeRange := backend.TimeRange{
		From: startTime,
		To:   qm.TimeRange.To,
	}

	return rsmpl.Resample(f, qm.FillMissing, alignedTimeRange, qm.Interval)
}
