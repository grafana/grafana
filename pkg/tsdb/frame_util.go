package tsdb

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/dataframe"
)

// SeriesToFrame converts a TimeSeries to a sdk Frame
func SeriesToFrame(series *TimeSeries) (*dataframe.Frame, error) {
	timeVec := make([]*time.Time, len(series.Points))
	floatVec := make([]*float64, len(series.Points))
	for idx, point := range series.Points {
		timeVec[idx], floatVec[idx] = convertTSDBTimePoint(point)
	}
	frame := dataframe.New(series.Name,
		dataframe.NewField("time", nil, timeVec),
		dataframe.NewField("value", dataframe.Labels(series.Tags), floatVec),
	)

	return frame, nil
}

// convertTSDBTimePoint coverts a tsdb.TimePoint into two values appropriate
// for Series values.
func convertTSDBTimePoint(point TimePoint) (t *time.Time, f *float64) {
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
