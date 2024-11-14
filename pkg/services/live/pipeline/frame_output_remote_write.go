package pipeline

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/prometheus/prompb"

	"github.com/grafana/grafana/pkg/services/live/remotewrite"
)

const flushInterval = 15 * time.Second

type RemoteWriteFrameOutput struct {
	mu sync.Mutex

	// Endpoint to send streaming frames to.
	Endpoint string

	// BasicAuth is an optional basic auth params.
	BasicAuth *BasicAuth

	// SampleMilliseconds allow defining an interval to sample points inside a channel
	// when outputting to remote write endpoint (on __name__ label basis). For example
	// when having a 20Hz stream and SampleMilliseconds 1000 then only one point in a
	// second will be sent to remote write endpoint. This reduces data resolution of course.
	// If not set - then no down-sampling will be performed. If SampleMilliseconds is
	// greater than flushInterval then each flush will include a point as we only keeping
	// track of timestamps in terms of each individual flush at the moment.
	SampleMilliseconds int64

	httpClient *http.Client
	buffer     []prompb.TimeSeries
}

func NewRemoteWriteFrameOutput(endpoint string, basicAuth *BasicAuth, sampleMilliseconds int64) *RemoteWriteFrameOutput {
	out := &RemoteWriteFrameOutput{
		Endpoint:           endpoint,
		BasicAuth:          basicAuth,
		SampleMilliseconds: sampleMilliseconds,
		httpClient:         &http.Client{Timeout: 2 * time.Second},
	}
	if out.Endpoint != "" {
		go out.flushPeriodically()
	}
	return out
}

const FrameOutputTypeRemoteWrite = "remoteWrite"

func (out *RemoteWriteFrameOutput) Type() string {
	return FrameOutputTypeRemoteWrite
}

func (out *RemoteWriteFrameOutput) flushPeriodically() {
	for range time.NewTicker(flushInterval).C {
		out.mu.Lock()
		if len(out.buffer) == 0 {
			out.mu.Unlock()
			continue
		}
		tmpBuffer := make([]prompb.TimeSeries, len(out.buffer))
		copy(tmpBuffer, out.buffer)
		out.buffer = nil
		out.mu.Unlock()

		err := out.flush(tmpBuffer)
		if err != nil {
			logger.Error("Error flush to remote write", "error", err)
			out.mu.Lock()
			// TODO: drop in case of large buffer size? Make several attempts only?
			out.buffer = append(tmpBuffer, out.buffer...)
			out.mu.Unlock()
		}
	}
}

func (out *RemoteWriteFrameOutput) sample(timeSeries []prompb.TimeSeries) []prompb.TimeSeries {
	samples := map[string]prompb.TimeSeries{}
	timestamps := map[string]int64{}

	for _, ts := range timeSeries {
		var name string

		for _, label := range ts.Labels {
			if label.Name == "__name__" {
				name = label.Value
				break
			}
		}

		sample, ok := samples[name]
		if !ok {
			sample = prompb.TimeSeries{}
		}

		lastTimestamp := timestamps[name]

		// In-place filtering, see https://github.com/golang/go/wiki/SliceTricks#filter-in-place.
		n := 0
		for _, s := range ts.Samples {
			if lastTimestamp == 0 || s.Timestamp > lastTimestamp+out.SampleMilliseconds {
				ts.Samples[n] = s
				n++
				lastTimestamp = s.Timestamp
			}
		}
		filteredSamples := ts.Samples[:n]

		timestamps[name] = lastTimestamp

		sample.Labels = ts.Labels
		sample.Samples = append(sample.Samples, filteredSamples...)
		samples[name] = sample
	}
	toReturn := make([]prompb.TimeSeries, 0, len(samples))
	for _, ts := range samples {
		toReturn = append(toReturn, ts)
	}
	return toReturn
}

func (out *RemoteWriteFrameOutput) flush(timeSeries []prompb.TimeSeries) error {
	numSamples := 0
	for _, ts := range timeSeries {
		numSamples += len(ts.Samples)
	}
	logger.Debug("Remote write flush", "numTimeSeries", len(timeSeries), "numSamples", numSamples)

	if out.SampleMilliseconds > 0 {
		timeSeries = out.sample(timeSeries)
		numSamples = 0
		for _, ts := range timeSeries {
			numSamples += len(ts.Samples)
		}
		logger.Debug("After down-sampling", "numTimeSeries", len(timeSeries), "numSamples", numSamples)
	}
	remoteWriteData, err := remotewrite.TimeSeriesToBytes(timeSeries)
	if err != nil {
		return fmt.Errorf("error converting time series to bytes: %v", err)
	}
	logger.Debug("Sending to remote write endpoint", "url", out.Endpoint, "bodyLength", len(remoteWriteData))
	req, err := http.NewRequest(http.MethodPost, out.Endpoint, bytes.NewReader(remoteWriteData))
	if err != nil {
		return fmt.Errorf("error constructing remote write request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-protobuf")
	req.Header.Set("Content-Encoding", "snappy")
	req.Header.Set("X-Prometheus-Remote-Write-Version", "0.1.0")
	if out.BasicAuth != nil {
		req.SetBasicAuth(out.BasicAuth.User, out.BasicAuth.Password)
	}

	started := time.Now()
	resp, err := out.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("error sending remote write request: %w", err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		logger.Error("Unexpected response code from remote write endpoint", "code", resp.StatusCode)
		return errors.New("unexpected response code from remote write endpoint")
	}
	logger.Debug("Successfully sent to remote write endpoint", "url", out.Endpoint, "elapsed", time.Since(started))
	return nil
}

func (out *RemoteWriteFrameOutput) OutputFrame(_ context.Context, _ Vars, frame *data.Frame) ([]*ChannelFrame, error) {
	if out.Endpoint == "" {
		logger.Debug("Skip sending to remote write: no url")
		return nil, nil
	}
	ts := remotewrite.TimeSeriesFromFramesLabelsColumn(frame)
	out.mu.Lock()
	out.buffer = append(out.buffer, ts...)
	out.mu.Unlock()
	return nil, nil
}
