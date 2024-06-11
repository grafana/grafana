package writer

import (
	"math"
	"math/rand/v2"
	"reflect"
	"slices"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestPrometheusWriter_Write(t *testing.T) {
	t.Skip("TODO: implement")
}

func TestPointsFromFrames(t *testing.T) {
	extraLabels := map[string]string{"extra": "label"}

	type testCase struct {
		name      string
		frameType data.FrameType
	}

	testCases := []testCase{
		{name: "wide", frameType: data.FrameTypeNumericWide},
		{name: "long", frameType: data.FrameTypeNumericLong},
		{name: "multi", frameType: data.FrameTypeNumericMulti},
	}

	t.Run("error when frames are empty", func(t *testing.T) {
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				frames := data.Frames{data.NewFrame("test")}
				now := time.Now()

				_, err := PointsFromFrames("test", now, frames, extraLabels)
				require.Error(t, err)
			})
		}
	})

	t.Run("maps frames correctly", func(t *testing.T) {
		series := []map[string]string{{"foo": "1"}, {"foo": "2"}, {"foo": "3"}, {"foo": "4"}}
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				frames := frameGenFromLabels(t, tc.frameType, series)
				now := time.Now()

				points, err := PointsFromFrames("test", now, frames, extraLabels)

				require.NoError(t, err)
				require.Len(t, points, len(series))
				for i, point := range points {
					v := extractValue(t, frames, series[i], tc.frameType)
					expectedLabels := map[string]string{"extra": "label"}
					for k, v := range series[i] {
						expectedLabels[k] = v
					}
					require.Equal(t, expectedLabels, point.Labels)
					require.Equal(t, "test", point.Name)
					require.Equal(t, now.Unix(), point.Metric.T)
					require.Equal(t, v, point.Metric.V)
				}
			})
		}
	})
}

func extractValue(t *testing.T, frames data.Frames, labels map[string]string, frameType data.FrameType) float64 {
	t.Helper()

	var f func(*testing.T, data.Frames, map[string]string) float64

	switch frames[0].Meta.Type {
	case data.FrameTypeNumericWide:
		f = extractValueWide
	case data.FrameTypeNumericLong:
		f = extractValueLong
	case data.FrameTypeNumericMulti:
		f = extractValueMulti
	default:
		t.Fatalf("unsupported frame type %q", frameType)
	}

	return f(t, frames, labels)
}

func extractValueWide(t *testing.T, frames data.Frames, labels map[string]string) float64 {
	t.Helper()

	frame := frames[0]
	for _, field := range frame.Fields {
		if reflect.DeepEqual(field.Labels, data.Labels(labels)) {
			return field.At(0).(float64)
		}
	}

	t.Fatalf("could not find value for labels %v", labels)
	return math.NaN()
}

func extractValueLong(t *testing.T, frames data.Frames, labels map[string]string) float64 {
	t.Helper()

	frame := frames[0]
	foundLabels := make(map[string]string)

	l := frame.Fields[0].Len()
	for i := 0; i < l; i++ {
		for _, field := range frame.Fields[1 : len(frame.Fields)-1] {
			foundLabels[field.Name] = field.At(i).(string)
		}
		if reflect.DeepEqual(foundLabels, labels) {
			return frame.Fields[len(frame.Fields)-1].At(i).(float64)
		}
	}

	t.Fatalf("could not find value for labels %v", labels)
	return math.NaN()
}

func extractValueMulti(t *testing.T, frames data.Frames, labels map[string]string) float64 {
	t.Helper()

	for _, frame := range frames {
		if reflect.DeepEqual(frame.Fields[1].Labels, data.Labels(labels)) {
			return frame.Fields[1].At(0).(float64)
		}
	}

	t.Fatalf("could not find value for labels %v", labels)
	return math.NaN()
}

func frameGenFromLabels(t *testing.T, frameType data.FrameType, labelSet []map[string]string) data.Frames {
	var f func(*testing.T, []map[string]string) data.Frames

	switch frameType {
	case data.FrameTypeNumericWide:
		f = frameGenWide
	case data.FrameTypeNumericLong:
		f = frameGenLong
	case data.FrameTypeNumericMulti:
		f = frameGenMulti
	default:
		return nil
	}

	return f(t, labelSet)
}

func frameGenWide(t *testing.T, labelMaps []map[string]string) data.Frames {
	t.Helper()

	frame := data.NewFrame("test", fieldGenWide(time.Now(), labelMaps)...)
	frame.SetMeta(&data.FrameMeta{
		Type:        data.FrameTypeNumericWide,
		TypeVersion: data.FrameTypeVersion{0, 1},
	})
	return data.Frames{frame}
}

func fieldGenWide(t time.Time, labelSet []map[string]string) []*data.Field {
	fields := make([]*data.Field, 1, len(labelSet)+1)
	fields[0] = data.NewField("T", nil, []time.Time{t})
	for _, labels := range labelSet {
		field := data.NewField("value", data.Labels(labels), []float64{rand.Float64() * (100 - 0)}) // arbitrary range
		fields = append(fields, field)
	}
	return fields
}

func frameGenLong(t *testing.T, labelSet []map[string]string) data.Frames {
	t.Helper()

	frame := data.NewFrame("test", fieldGenLong(time.Now(), labelSet)...)
	frame.SetMeta(&data.FrameMeta{
		Type:        data.FrameTypeNumericLong,
		TypeVersion: data.FrameTypeVersion{0, 1},
	})

	return data.Frames{frame}
}

func fieldGenLong(t time.Time, labelSet []map[string]string) []*data.Field {
	fields := make([]*data.Field, 1, len(labelSet)+1)
	times := make([]time.Time, 0, len(labelSet))
	labelFields := make(map[string][]string)
	values := make([]float64, 0, len(labelSet))

	for _, labels := range labelSet {
		times = append(times, t)
		for k, v := range labels {
			if !slices.Contains(labelFields[k], v) {
				labelFields[k] = append(labelFields[k], v)
			}
		}
		values = append(values, rand.Float64()*(100-0)) // arbitrary range
	}
	fields[0] = data.NewField("T", nil, times)
	for k, v := range labelFields {
		fields = append(fields, data.NewField(k, nil, v))
	}
	fields = append(fields, data.NewField("value", nil, values))

	return fields
}

func frameGenMulti(t *testing.T, labelSet []map[string]string) data.Frames {
	t.Helper()

	frames := make(data.Frames, 0, len(labelSet))
	now := time.Now()
	for _, labels := range labelSet {
		frame := data.NewFrame("test",
			data.NewField("T", nil, []time.Time{now}),
			data.NewField("value", data.Labels(labels), []float64{rand.Float64() * (100 - 0)}),
		)
		frame.SetMeta(&data.FrameMeta{
			Type:        data.FrameTypeNumericMulti,
			TypeVersion: data.FrameTypeVersion{0, 1},
		})
		frames = append(frames, frame)
	}

	return frames
}
