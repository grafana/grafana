package legacydata

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// SeriesToFrame converts a DataTimeSeries to an SDK frame.
func SeriesToFrame(series DataTimeSeries) (*data.Frame, error) {
	timeVec := make([]*time.Time, len(series.Points))
	floatVec := make([]*float64, len(series.Points))
	for idx, point := range series.Points {
		timeVec[idx], floatVec[idx] = convertDataTimePoint(point)
	}
	frame := data.NewFrame(series.Name,
		data.NewField("time", nil, timeVec),
		data.NewField("value", data.Labels(series.Tags), floatVec),
	)

	return frame, nil
}

// convertDataTimePoint converts a DataTimePoint into two values appropriate
// for Series values.
func convertDataTimePoint(point DataTimePoint) (t *time.Time, f *float64) {
	timeIdx, valueIdx := 1, 0
	if point[timeIdx].Valid { // Assuming valid is null?
		tI := int64(point[timeIdx].Float64)
		uT := time.Unix(tI/int64(1e+3), (tI%int64(1e+3))*int64(1e+6)) // time.Time from millisecond unix ts
		t = &uT
	}
	if point[valueIdx].Valid {
		f = &point[valueIdx].Float64
	}
	return
}
