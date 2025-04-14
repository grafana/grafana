package mathexp

import (
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// The upsample function
// +enum
type Upsampler string

const (
	// Use the last seen value
	UpsamplerPad Upsampler = "pad"

	// backfill
	UpsamplerBackfill Upsampler = "backfilling"

	// Do not fill values (nill)
	UpsamplerFillNA Upsampler = "fillna"
)

// Resample turns the Series into a Number based on the given reduction function
func (s Series) Resample(refID string, interval time.Duration, downsampler ReducerID, upsampler Upsampler, from, to time.Time) (Series, error) {
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
		for sIdx != s.Len() {
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
			case UpsamplerPad:
				if lastSeen != nil {
					value = lastSeen
				} else {
					value = nil
				}
			case UpsamplerBackfill:
				if sIdx == s.Len() { // no vals left
					value = nil
				} else {
					_, value = s.GetPoint(sIdx)
				}
			case UpsamplerFillNA:
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
			case ReducerSum:
				tmp = Sum(&ff)
			case ReducerMean:
				tmp = Avg(&ff)
			case ReducerMin:
				tmp = Min(&ff)
			case ReducerMax:
				tmp = Max(&ff)
			case ReducerLast:
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
