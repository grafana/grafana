package remotewrite

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

func TestTsFromFrames(t *testing.T) {
	t1 := time.Now()
	t2 := time.Now().Add(time.Second)
	frame := data.NewFrame("test",
		data.NewField("time", map[string]string{"test": "yes"}, []time.Time{t1, t2}),
		data.NewField("value", map[string]string{"test": "yes"}, []float64{1.0, 2.0}),
	)
	ts := TimeSeriesFromFrames(frame)
	require.Len(t, ts, 1)
	require.Len(t, ts[0].Samples, 2)
	require.Equal(t, toSampleTime(t1), ts[0].Samples[0].Timestamp)
	require.Equal(t, toSampleTime(t2), ts[0].Samples[1].Timestamp)
	require.Len(t, ts[0].Labels, 2)
	require.Equal(t, "test", ts[0].Labels[0].Name)
	require.Equal(t, "yes", ts[0].Labels[0].Value)
	require.Equal(t, "__name__", ts[0].Labels[1].Name)
	require.Equal(t, "test_value", ts[0].Labels[1].Value)
}

func TestTsFromFramesMultipleSeries(t *testing.T) {
	t1 := time.Now()
	t2 := time.Now().Add(time.Second)
	frame := data.NewFrame("test",
		data.NewField("time", nil, []time.Time{t1, t2}),
		data.NewField("value1", nil, []float64{1.0, 2.0}),
		data.NewField("value2", nil, []bool{true, false}),
		data.NewField("value3", nil, []float64{3.0, 4.0}),
	)
	ts := TimeSeriesFromFrames(frame)
	require.Len(t, ts, 2)
	require.Len(t, ts[0].Samples, 2)
	require.Equal(t, toSampleTime(t1), ts[0].Samples[0].Timestamp)
	require.Equal(t, toSampleTime(t2), ts[0].Samples[1].Timestamp)
	require.Equal(t, 1.0, ts[0].Samples[0].Value)
	require.Equal(t, 2.0, ts[0].Samples[1].Value)
	require.Len(t, ts[1].Samples, 2)
	require.Equal(t, toSampleTime(t1), ts[1].Samples[0].Timestamp)
	require.Equal(t, toSampleTime(t2), ts[1].Samples[1].Timestamp)
	require.Equal(t, 3.0, ts[1].Samples[0].Value)
	require.Equal(t, 4.0, ts[1].Samples[1].Value)
}

func TestTsFromFramesMultipleFrames(t *testing.T) {
	t1 := time.Now()
	t2 := time.Now().Add(time.Second)
	t3 := time.Now().Add(2 * time.Second)
	t4 := time.Now().Add(3 * time.Second)
	frame1 := data.NewFrame("test",
		data.NewField("time", nil, []time.Time{t1, t2}),
		data.NewField("value1", nil, []float64{1.0, 2.0}),
	)
	frame2 := data.NewFrame("test",
		data.NewField("time", nil, []time.Time{t3, t4}),
		data.NewField("value3", nil, []float64{3.0, 4.0}),
	)
	ts := TimeSeriesFromFrames(frame1, frame2)
	require.Len(t, ts, 2)
	require.Len(t, ts[0].Samples, 2)
	require.Equal(t, toSampleTime(t1), ts[0].Samples[0].Timestamp)
	require.Equal(t, toSampleTime(t2), ts[0].Samples[1].Timestamp)
	require.Equal(t, 1.0, ts[0].Samples[0].Value)
	require.Equal(t, 2.0, ts[0].Samples[1].Value)
	require.Len(t, ts[1].Samples, 2)
	require.Equal(t, toSampleTime(t3), ts[1].Samples[0].Timestamp)
	require.Equal(t, toSampleTime(t4), ts[1].Samples[1].Timestamp)
	require.Equal(t, 3.0, ts[1].Samples[0].Value)
	require.Equal(t, 4.0, ts[1].Samples[1].Value)
}

func TestSerialize(t *testing.T) {
	frame := data.NewFrame("test",
		data.NewField("time", nil, []time.Time{time.Now(), time.Now().Add(time.Second)}),
		data.NewField("value", nil, []float64{1.0, 2.0}),
	)
	_, err := Serialize(frame)
	require.NoError(t, err)
}
