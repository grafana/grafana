package pipeline

import (
	"testing"
	"time"

	"github.com/prometheus/prometheus/prompb"
	"github.com/stretchr/testify/require"
)

func TestRemoteWriteFrameOutput_sample(t *testing.T) {
	// Given 2 time series in a buffer, we output the same number
	// of time series but with one sample removed from each.
	now := time.Now().UnixNano() / int64(time.Millisecond)
	timeSeries := []prompb.TimeSeries{
		{
			Labels: []prompb.Label{
				{
					Name:  "__name__",
					Value: "test1",
				},
			},
			Samples: []prompb.Sample{
				{
					Timestamp: now,
					Value:     1,
				},
				{
					Timestamp: now + 100,
					Value:     2,
				},
			},
		},
		{
			Labels: []prompb.Label{
				{
					Name:  "__name__",
					Value: "test2",
				},
			},
			Samples: []prompb.Sample{
				{
					Timestamp: now,
					Value:     1,
				},
				{
					Timestamp: now + 100,
					Value:     2,
				},
			},
		},
	}
	out := NewRemoteWriteFrameOutput("", nil, 500)
	sampledTimeSeries := out.sample(timeSeries)
	require.Len(t, sampledTimeSeries, 2)

	require.Equal(t, []prompb.Sample{{Timestamp: now, Value: 1}}, sampledTimeSeries[0].Samples)
	require.Equal(t, []prompb.Sample{{Timestamp: now, Value: 1}}, sampledTimeSeries[1].Samples)
}

func TestRemoteWriteFrameOutput_sample_merge(t *testing.T) {
	// Given 3 time series in a buffer, we output only
	// 2 time series since we merge by __name__ label.
	now := time.Now().UnixNano() / int64(time.Millisecond)
	timeSeries := []prompb.TimeSeries{
		{
			Labels: []prompb.Label{
				{
					Name:  "__name__",
					Value: "test1",
				},
			},
			Samples: []prompb.Sample{
				{
					Timestamp: now,
					Value:     1,
				},
				{
					Timestamp: now + 100,
					Value:     2,
				},
				{
					Timestamp: now + 200,
					Value:     2,
				},
			},
		},
		{
			Labels: []prompb.Label{
				{
					Name:  "__name__",
					Value: "test2",
				},
			},
			Samples: []prompb.Sample{
				{
					Timestamp: now,
					Value:     1,
				},
				{
					Timestamp: now + 100,
					Value:     2,
				},
			},
		},
		{
			Labels: []prompb.Label{
				{
					Name:  "__name__",
					Value: "test2",
				},
			},
			Samples: []prompb.Sample{
				{
					Timestamp: now,
					Value:     1,
				},
				{
					Timestamp: now + 100,
					Value:     2,
				},
			},
		},
	}
	out := NewRemoteWriteFrameOutput("", nil, 50)
	sampledTimeSeries := out.sample(timeSeries)
	require.Len(t, sampledTimeSeries, 2)

	expectedSamples := map[string][]prompb.Sample{
		"test1": timeSeries[0].Samples,
		"test2": {
			{
				Timestamp: now,
				Value:     1,
			},
			{
				Timestamp: now + 100,
				Value:     2,
			},
		},
	}

	require.Equal(t, expectedSamples[sampledTimeSeries[0].Labels[0].Value], sampledTimeSeries[0].Samples)
	require.Equal(t, expectedSamples[sampledTimeSeries[1].Labels[0].Value], sampledTimeSeries[1].Samples)
}
