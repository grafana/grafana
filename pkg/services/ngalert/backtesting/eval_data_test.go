package backtesting

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

func GenerateWideSeriesFrame(size int, resolution time.Duration) *data.Frame {
	fields := make(data.Fields, 0, rand.Intn(4)+2)
	fields = append(fields, data.NewField("time", nil, make([]time.Time, size)))
	for i := 1; i < cap(fields); i++ {
		name := fmt.Sprintf("values-%d", i)
		fields = append(fields, data.NewField(name, models.GenerateAlertLabels(rand.Intn(4)+1, name), make([]int64, size)))
	}
	frame := data.NewFrame("test", fields...)

	tmili := time.Now().UnixMilli()
	tmili = tmili - tmili%resolution.Milliseconds()
	current := time.UnixMilli(tmili).Add(-resolution * time.Duration(size))
	for i := 0; i < size; i++ {
		vals := make([]interface{}, 0, len(frame.Fields))
		vals = append(vals, current)
		for i := 1; i < cap(vals); i++ {
			vals = append(vals, rand.Int63n(2)-1) // random value [-1,1]
		}
		frame.SetRow(i, vals...)
		current = current.Add(resolution)
	}
	return frame
}

func TestDataEvaluator_New(t *testing.T) {
	t.Run("should fail if frame is not TimeSeriesTypeWide", func(t *testing.T) {
		t.Run("but TimeSeriesTypeNot", func(t *testing.T) {
			frameTimeSeriesTypeNot := data.NewFrame("test")
			require.Equal(t, data.TimeSeriesTypeNot, frameTimeSeriesTypeNot.TimeSeriesSchema().Type)
			_, err := newDataEvaluator(util.GenerateShortUID(), frameTimeSeriesTypeNot)
			require.Error(t, err)
		})
		t.Run("but TimeSeriesTypeLong", func(t *testing.T) {
			frameTimeSeriesTypeLong := data.NewFrame("test", data.NewField("time", nil, make([]time.Time, 0)), data.NewField("data", nil, make([]string, 0)), data.NewField("value", nil, make([]int64, 0)))
			require.Equal(t, data.TimeSeriesTypeLong, frameTimeSeriesTypeLong.TimeSeriesSchema().Type)
			_, err := newDataEvaluator(util.GenerateShortUID(), frameTimeSeriesTypeLong)
			require.Error(t, err)
		})
	})

	t.Run("should convert fame to series and sort it", func(t *testing.T) {
		refID := util.GenerateShortUID()
		frameSize := rand.Intn(100) + 100
		frame := GenerateWideSeriesFrame(frameSize, time.Second)
		rand.Shuffle(frameSize, func(i, j int) {
			rowi := frame.RowCopy(i)
			rowj := frame.RowCopy(j)
			frame.SetRow(i, rowj...)
			frame.SetRow(j, rowi...)
		})
		e, err := newDataEvaluator(refID, frame)
		require.NoError(t, err)
		require.Equal(t, refID, e.refID)
		require.Len(t, e.data, len(frame.Fields)-1) // timestamp is not counting
		for idx, series := range e.data {
			assert.Equalf(t, series.Len(), frameSize, "Length of the series %d is %d but expected to be %d", idx, series.Len(), frameSize)
			assert.Equalf(t, frame.Fields[idx+1].Labels, series.GetLabels(), "Labels of series %d does not match with original field labels", idx)
			assert.Lessf(t, series.GetTime(0), series.GetTime(1), "Series %d is expected to be sorted in ascending order", idx)
		}
	})
}

func TestDataEvaluator_Eval(t *testing.T) {
	type results struct {
		time    time.Time
		results eval.Results
	}

	refID := util.GenerateShortUID()
	frameSize := rand.Intn(100) + 100
	frame := GenerateWideSeriesFrame(frameSize, time.Second)
	from := frame.At(0, 0).(time.Time)
	to := frame.At(0, frame.Rows()-1).(time.Time)
	evaluator, err := newDataEvaluator(refID, frame)
	require.NoErrorf(t, err, "Frame %v", frame)

	t.Run("should use data points when frame resolution matches evaluation interval", func(t *testing.T) {
		r := make([]results, 0, frame.Rows())

		invterval := time.Second

		resultsCount := int(to.Sub(from).Seconds() / invterval.Seconds())

		err = evaluator.Eval(context.Background(), from, to, time.Second, func(now time.Time, res eval.Results) error {
			r = append(r, results{
				now, res,
			})
			return nil
		})
		require.NoError(t, err)

		require.Len(t, r, resultsCount)

		t.Run("results should be in the same refID", func(t *testing.T) {
			for _, res := range r {
				for _, result := range res.results {
					require.Contains(t, result.Values, refID)
				}
			}
		})

		t.Run("should be Alerting if value is not 0", func(t *testing.T) {
			for _, res := range r {
				for _, result := range res.results {
					v := result.Values[refID].Value
					require.NotNil(t, v)
					if *v == 0 {
						require.Equalf(t, eval.Normal, result.State, "Result value is %d", *v)
					} else {
						require.Equalf(t, eval.Alerting, result.State, "Result value is %d", *v)
					}
				}
			}
		})

		t.Run("results should be in ascending order", func(t *testing.T) {
			var prev = results{}
			for i := 0; i < len(r); i++ {
				current := r[i]
				if i > 0 {
					require.Less(t, prev.time, current.time)
				} else {
					require.Equal(t, from, current.time)
				}
				prev = current
			}
		})

		t.Run("results should be in the same order as fields in frame", func(t *testing.T) {
			for i := 0; i < len(r); i++ {
				current := r[i]
				for idx, result := range current.results {
					field := frame.Fields[idx+1]
					require.Equal(t, field.Labels, result.Instance)
					expected, err := field.FloatAt(i)
					require.NoError(t, err)
					require.EqualValues(t, expected, *result.Values[refID].Value)
				}
			}
		})
	})
	t.Run("when frame resolution does not match evaluation interval", func(t *testing.T) {
		t.Run("should closest timestamp if interval is smaller than frame resolution", func(t *testing.T) {
			interval := 300 * time.Millisecond
			size := to.Sub(from).Milliseconds() / interval.Milliseconds()
			r := make([]results, 0, size)

			err = evaluator.Eval(context.Background(), from, to, interval, func(now time.Time, res eval.Results) error {
				r = append(r, results{
					now, res,
				})
				return nil
			})

			currentRowIdx := 0
			nextTime := frame.At(0, currentRowIdx+1).(time.Time)
			for id, current := range r {
				if !current.time.Before(nextTime) {
					currentRowIdx++
					if frame.Rows() > currentRowIdx+1 {
						nextTime = frame.At(0, currentRowIdx+1).(time.Time)
					}
				}
				for idx, result := range current.results {
					field := frame.Fields[idx+1]
					require.Equal(t, field.Labels, result.Instance)
					expected, err := field.FloatAt(currentRowIdx)
					require.NoError(t, err)
					require.EqualValuesf(t, expected, *result.Values[refID].Value, "Time %d", id)
				}
			}
		})

		t.Run("should downscale series if interval is smaller using previous value", func(t *testing.T) {
			interval := 5 * time.Second
			size := int(to.Sub(from).Seconds() / interval.Seconds())
			r := make([]results, 0, size)

			err = evaluator.Eval(context.Background(), from, to, interval, func(now time.Time, res eval.Results) error {
				r = append(r, results{
					now, res,
				})
				return nil
			})

			currentRowIdx := 0
			var frameDate time.Time
			for resultNum, current := range r {
				for i := currentRowIdx; i < frame.Rows(); i++ {
					d := frame.At(0, i).(time.Time)
					if d.Equal(current.time) {
						currentRowIdx = i
						frameDate = d
						break
					}
					if d.After(current.time) {
						require.Fail(t, "Interval is not aligned")
					}
				}
				for idx, result := range current.results {
					field := frame.Fields[idx+1]
					require.Equal(t, field.Labels, result.Instance)
					expected, err := field.FloatAt(currentRowIdx)
					require.NoError(t, err)
					require.EqualValuesf(t, expected, *result.Values[refID].Value, "Current time [%v] frame time [%v]. Result #%d", current.time, frameDate, resultNum)
				}
			}
		})
	})
	t.Run("when eval interval is larger than data", func(t *testing.T) {
		t.Run("should be noData until the frame interval", func(t *testing.T) {
			newFrom := from.Add(-10 * time.Second)
			r := make([]results, 0, int(to.Sub(newFrom).Seconds()))
			err = evaluator.Eval(context.Background(), newFrom, to, time.Second, func(now time.Time, res eval.Results) error {
				r = append(r, results{
					now, res,
				})
				return nil
			})

			rowIdx := 0
			for _, current := range r {
				if current.time.Before(from) {
					require.Len(t, current.results, 1)
					require.Equal(t, eval.NoData, current.results[0].State)
				} else {
					for idx, result := range current.results {
						field := frame.Fields[idx+1]
						require.Equal(t, field.Labels, result.Instance)
						expected, err := field.FloatAt(rowIdx)
						require.NoError(t, err)
						require.EqualValues(t, expected, *result.Values[refID].Value)
					}
					rowIdx++
				}
			}
		})

		t.Run("should be the last value after the frame interval", func(t *testing.T) {
			newTo := to.Add(10 * time.Second)
			r := make([]results, 0, int(newTo.Sub(from).Seconds()))
			err = evaluator.Eval(context.Background(), from, newTo, time.Second, func(now time.Time, res eval.Results) error {
				r = append(r, results{
					now, res,
				})
				return nil
			})

			rowIdx := 0
			for _, current := range r {
				for idx, result := range current.results {
					field := frame.Fields[idx+1]
					require.Equal(t, field.Labels, result.Instance)
					expected, err := field.FloatAt(rowIdx)
					require.NoError(t, err)
					require.EqualValues(t, expected, *result.Values[refID].Value)
				}
				if current.time.Before(to) {
					rowIdx++
				}
			}
		})
	})
	t.Run("should stop if callback error", func(t *testing.T) {
		expectedError := errors.New("error")
		evals := 0
		err = evaluator.Eval(context.Background(), from, to, time.Second, func(now time.Time, res eval.Results) error {
			if evals > 5 {
				return expectedError
			}
			evals++
			return nil
		})
		require.ErrorIs(t, err, expectedError)
	})
}
