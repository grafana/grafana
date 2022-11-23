package mathexp

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// Resample turns the Series into a Number based on the given reduction function
func (s Series) Resample(refID string, interval time.Duration, downsampler string, upsampler string, from, to time.Time) (Series, error) {
	newSeriesLength := int(float64(to.Sub(from).Nanoseconds()) / float64(interval.Nanoseconds()))
	if newSeriesLength <= 0 {
		return s, fmt.Errorf("the series cannot be sampled further; the time range is shorter than the interval")
	}
	resampled := NewSeries(refID, s.GetLabels(), newSeriesLength+1)
	bookmark := 0
	var lastSeen *float64
	idx := 0
	t := from
	for !t.After(to) && idx <= newSeriesLength {
		vals := make([]*float64, 0)
		sIdx := bookmark
		for {
			if sIdx == s.Len() {
				break
			}
			st, v := s.GetPoint(sIdx)
			if st.After(t) {
				break
			}
			bookmark++
			sIdx++
			lastSeen = v
			vals = append(vals, v)
		}
		var value *float64
		if len(vals) == 0 { // upsampling
			switch upsampler {
			case "pad":
				if lastSeen != nil {
					value = lastSeen
				} else {
					value = nil
				}
			case "backfilling":
				if sIdx == s.Len() { // no vals left
					value = nil
				} else {
					_, value = s.GetPoint(sIdx)
				}
			case "fillna":
				value = nil
			default:
				return s, fmt.Errorf("upsampling %v not implemented", upsampler)
			}
		} else if len(vals) == 1 {
			value = vals[0]
		} else { // downsampling
			fVec := data.NewField("", s.GetLabels(), vals)
			ff := Float64Field(*fVec)
			var tmp *float64
			switch downsampler {
			case "sum":
				tmp = Sum(&ff)
			case "mean":
				tmp = Avg(&ff)
			case "min":
				tmp = Min(&ff)
			case "max":
				tmp = Max(&ff)
			case "last":
				tmp = Last(&ff)
			default:
				return s, fmt.Errorf("downsampling %v not implemented", downsampler)
			}
			value = tmp
		}
		resampled.SetPoint(idx, t, value)
		t = t.Add(interval)
		idx++
	}
	return resampled, nil
}
