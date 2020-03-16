package tsdb

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/null"
)

// SeriesToFrame converts a TimeSeries to a sdk Frame
func SeriesToFrame(series *TimeSeries) (*data.Frame, error) {
	timeVec := make([]*time.Time, len(series.Points))
	floatVec := make([]*float64, len(series.Points))
	for idx, point := range series.Points {
		timeVec[idx], floatVec[idx] = convertTSDBTimePoint(point)
	}
	frame := data.NewFrame(series.Name,
		data.NewField("time", nil, timeVec),
		data.NewField("value", data.Labels(series.Tags), floatVec),
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

// FrameToSeries converts a frame that is a valid time series as per data.TimeSeriesSchema()
// to a TimeSeriesSlice.
func FrameToSeries(frame *data.Frame) (TimeSeriesSlice, error) {
	tsSchema := frame.TimeSeriesSchema()
	if tsSchema.Type == data.TimeSeriesTypeNot {
		return nil, fmt.Errorf("input frame is not recognized as a time series")
	}
	// If Long, make wide
	if tsSchema.Type == data.TimeSeriesTypeLong {
		var err error
		frame, err = data.LongToWide(frame)
		if err != nil {
			return nil, err // TODO: Kyle needs to figure out error wrapping and get with times.
		}
		tsSchema = frame.TimeSeriesSchema()
	}
	seriesCount := len(tsSchema.ValueIndices)
	seriesSlice := make(TimeSeriesSlice, 0, seriesCount)
	timeField := frame.Fields[tsSchema.TimeIndex]
	timeNullFloatSlice := make([]null.Float, timeField.Len())
	for i := 0; i < timeField.Len(); i++ {
		tStamp, err := timeField.FloatAt(i)
		if err != nil {
			return nil, err
		}
		timeNullFloatSlice[i] = null.FloatFrom(tStamp)
	}
	for _, fieldIdx := range tsSchema.ValueIndices {
		field := frame.Fields[fieldIdx]
		ts := &TimeSeries{
			Name:   field.Name,
			Tags:   field.Labels.Copy(),
			Points: make(TimeSeriesPoints, field.Len()),
		}
		for rowIdx := 0; rowIdx < field.Len(); rowIdx++ {
			val, err := field.FloatAt(rowIdx)
			if err != nil {
				return nil, err // TODO: wrap...
			}
			ts.Points[rowIdx] = TimePoint{
				null.FloatFrom(val),
				timeNullFloatSlice[rowIdx],
			}
		}
		seriesSlice = append(seriesSlice, ts)
	}

	return seriesSlice, nil

}

// FramesFromBytes returns a data.Frame slice from marshalled arrow dataframes.
func FramesFromBytes(bFrames [][]byte) ([]*data.Frame, error) {
	frames := make([]*data.Frame, len(bFrames))
	for i, bFrame := range bFrames {
		var err error
		frames[i], err = data.UnmarshalArrow(bFrame)
		if err != nil {
			return nil, err // TODO: wrap
		}
	}
	return frames, nil
}
