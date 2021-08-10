package sqleng

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// getRowFillValues populates a slice of values corresponding to the provided data.Frame fields.
// Uses data.FillMissing settings to fill in values that are missing. Values are normally missing
// due to that the selected query interval doesn't match the intervals of the data returned from
// the query and therefore needs to be resampled.
func getRowFillValues(f *data.Frame, tsSchema data.TimeSeriesSchema, currentTime time.Time,
	fillMissing *data.FillMissing, intermediateRows []int, lastSeenRowIdx int) []interface{} {
	vals := make([]interface{}, 0, len(f.Fields))
	for i, field := range f.Fields {
		// if the current field is the time index of the series
		// set the new value to be added to the new timestamp
		if i == tsSchema.TimeIndex {
			switch f.Fields[tsSchema.TimeIndex].Type() {
			case data.FieldTypeTime:
				vals = append(vals, currentTime)
			default:
				vals = append(vals, &currentTime)
			}
			continue
		}

		isValueField := false
		for _, idx := range tsSchema.ValueIndices {
			if i == idx {
				isValueField = true
				break
			}
		}

		// if the current field is value Field
		// set the new value to the last seen field value (if such exists)
		// otherwise set the appropriate value according to the fillMissing mode
		// if the current field is string field)
		// set the new value to be added to the last seen value (if such exists)
		// if the Frame is wide then there should not be any string fields
		var newVal interface{}
		if isValueField {
			if len(intermediateRows) > 0 {
				// instead of setting the last seen
				// we could set avg, sum, min or max
				// of the intermediate values for each field
				newVal = f.At(i, intermediateRows[len(intermediateRows)-1])
			} else {
				val, err := data.GetMissing(fillMissing, field, lastSeenRowIdx)
				if err == nil {
					newVal = val
				}
			}
		} else if lastSeenRowIdx >= 0 {
			newVal = f.At(i, lastSeenRowIdx)
		}
		vals = append(vals, newVal)
	}
	return vals
}

// resample resample provided time-series data.Frame.
// This is needed in the case of the selected query interval doesn't
// match the intervals of the time-series field in the data.Frame and
// therefore needs to be resampled.
func resample(f *data.Frame, qm dataQueryModel) (*data.Frame, error) {
	tsSchema := f.TimeSeriesSchema()
	if tsSchema.Type == data.TimeSeriesTypeNot {
		return f, fmt.Errorf("can not fill missing, not timeseries frame")
	}

	if qm.Interval == 0 {
		return f, nil
	}

	newFields := make([]*data.Field, 0, len(f.Fields))
	for _, field := range f.Fields {
		newField := data.NewFieldFromFieldType(field.Type(), 0)
		newField.Name = field.Name
		newField.Labels = field.Labels
		newFields = append(newFields, newField)
	}
	resampledFrame := data.NewFrame(f.Name, newFields...)
	resampledFrame.Meta = f.Meta

	resampledRowidx := 0
	lastSeenRowIdx := -1
	timeField := f.Fields[tsSchema.TimeIndex]

	startUnixTime := qm.TimeRange.From.Unix() / int64(qm.Interval.Seconds()) * int64(qm.Interval.Seconds())
	startTime := time.Unix(startUnixTime, 0)

	for currentTime := startTime; !currentTime.After(qm.TimeRange.To); currentTime = currentTime.Add(qm.Interval) {
		initialRowIdx := 0
		if lastSeenRowIdx > 0 {
			initialRowIdx = lastSeenRowIdx + 1
		}
		intermediateRows := make([]int, 0)
		for {
			rowLen, err := f.RowLen()
			if err != nil {
				return f, err
			}
			if initialRowIdx == rowLen {
				break
			}

			t, ok := timeField.ConcreteAt(initialRowIdx)
			if !ok {
				return f, fmt.Errorf("time point is nil")
			}

			// take the last element of the period current - interval <-> current, use it as value for current data point value
			previousTime := currentTime.Add(-qm.Interval)
			if t.(time.Time).After(previousTime) {
				if !t.(time.Time).After(currentTime) {
					intermediateRows = append(intermediateRows, initialRowIdx)
				} else {
					break
				}
			}

			lastSeenRowIdx = initialRowIdx
			initialRowIdx++
		}

		// no intermediate points; set values following fill missing mode
		fieldVals := getRowFillValues(f, tsSchema, currentTime, qm.FillMissing, intermediateRows, lastSeenRowIdx)

		resampledFrame.InsertRow(resampledRowidx, fieldVals...)
		resampledRowidx++
	}

	return resampledFrame, nil
}
