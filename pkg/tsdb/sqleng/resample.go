package sqleng

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func getRowFillValues(f *data.Frame, tsSchema data.TimeSeriesSchema, currentTime time.Time, fillMissing *data.FillMissing, intermidiateRows []int, lastSeenRowIdx int) []interface{} {
	vals := make([]interface{}, 0)
	for fieldIdx := 0; fieldIdx < len(f.Fields); fieldIdx++ {
		// if the current field is the time index of the series
		// set the new value to be added to the new timestamp
		if fieldIdx == tsSchema.TimeIndex {
			switch f.Fields[tsSchema.TimeIndex].Type() {
			case data.FieldTypeTime:
				vals = append(vals, currentTime)
			case data.FieldTypeNullableTime:
				vals = append(vals, &currentTime)
			}
			continue
		}

		isValueField := false
		for _, idx := range tsSchema.ValueIndices {
			if fieldIdx == idx {
				isValueField = true
			}
		}

		var newVal interface{}

		// if the current field is value Field
		// set the new value to the last seen field value (if such exists)
		// otherwise set the appropriate value according to the fillMissing mode
		// if the current field is string field)
		// set the new value to be added to the last seen value (if such exists)
		// if the Frame is wide then there should not be any string fields
		switch isValueField {
		case true:
			if len(intermidiateRows) > 0 {
				// instead of setting the last seen
				// we could set avg, sum, min or max
				// of the intermidiate values for each field
				newVal = f.At(fieldIdx, intermidiateRows[len(intermidiateRows)-1])
			} else {
				val, err := data.GetMissing(fillMissing, f.Fields[fieldIdx], lastSeenRowIdx)
				if err == nil {
					newVal = val
				}
			}
		case false:
			if lastSeenRowIdx >= 0 {
				newVal = f.At(fieldIdx, lastSeenRowIdx)
			}
		}
		vals = append(vals, newVal)
	}
	return vals
}

func resample(f *data.Frame, qm DataQueryModel) (*data.Frame, error) {
	tsSchema := f.TimeSeriesSchema()
	if tsSchema.Type == data.TimeSeriesTypeNot {
		return f, fmt.Errorf("can not fill missing, not timeseries frame")
	}

	if qm.Interval == 0 {
		return f, nil
	}

	newFields := make([]*data.Field, 0)
	for fieldIdx := 0; fieldIdx < len(f.Fields); fieldIdx++ {
		newField := data.NewFieldFromFieldType(f.Fields[fieldIdx].Type(), 0)
		newField.Name = f.Fields[fieldIdx].Name
		newField.Labels = f.Fields[fieldIdx].Labels
		newFields = append(newFields, newField)
	}
	resampledFrame := data.NewFrame(f.Name, newFields...)
	resampledFrame.Meta = f.Meta

	resampledRowidx := 0
	lastSeenRowIdx := -1
	timeField := f.Fields[tsSchema.TimeIndex]

	for currentTime := qm.TimeRange.From; !currentTime.After(qm.TimeRange.To); currentTime = currentTime.Add(qm.Interval) {
		initialRowIdx := 0
		if lastSeenRowIdx > 0 {
			initialRowIdx = lastSeenRowIdx + 1
		}
		intermidiateRows := make([]int, 0)
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
			if t.(time.Time).After(currentTime) {
				nextTime := currentTime.Add(qm.Interval)
				if t.(time.Time).Before(nextTime) {
					intermidiateRows = append(intermidiateRows, initialRowIdx)
					lastSeenRowIdx = initialRowIdx
					initialRowIdx++
				}
				break
			}

			intermidiateRows = append(intermidiateRows, initialRowIdx)
			lastSeenRowIdx = initialRowIdx
			initialRowIdx++
		}

		// no intermidiate points; set values following fill missing mode
		fieldVals := getRowFillValues(f, tsSchema, currentTime, qm.FillMissing, intermidiateRows, lastSeenRowIdx)

		resampledFrame.InsertRow(resampledRowidx, fieldVals...)
		resampledRowidx++
	}
	return resampledFrame, nil
}
