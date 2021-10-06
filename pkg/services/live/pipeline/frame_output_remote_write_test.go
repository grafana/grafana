package pipeline

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/prometheus/prometheus/prompb"
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
	out := NewRemoteWriteFrameOutput(RemoteWriteConfig{
		SampleMilliseconds: 500,
	})
	timeSeries = out.sample(timeSeries)
	require.Len(t, timeSeries, 2)

	require.Len(t, timeSeries[0].Samples, 1)
	require.Len(t, timeSeries[1].Samples, 1)
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
	out := NewRemoteWriteFrameOutput(RemoteWriteConfig{
		SampleMilliseconds: 50,
	})
	timeSeries = out.sample(timeSeries)
	require.Len(t, timeSeries, 2)

	require.Len(t, timeSeries[0].Samples, 2)
	require.Len(t, timeSeries[1].Samples, 2)
}
