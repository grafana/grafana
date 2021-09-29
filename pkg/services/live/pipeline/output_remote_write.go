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
	"github.com/grafana/grafana/pkg/services/live/remotewrite"
	"github.com/prometheus/prometheus/prompb"
)

type RemoteWriteConfig struct {
	// Endpoint to send streaming frames to.
	Endpoint string `json:"endpoint"`
	// User is a user for remote write request.
	User string `json:"user"`
	// Password for remote write endpoint.
	Password string `json:"password"`
}

type RemoteWriteOutput struct {
	mu         sync.Mutex
	config     RemoteWriteConfig
	httpClient *http.Client
	buffer     []prompb.TimeSeries
}

func NewRemoteWriteOutput(config RemoteWriteConfig) *RemoteWriteOutput {
	out := &RemoteWriteOutput{
		config:     config,
		httpClient: &http.Client{Timeout: 2 * time.Second},
	}
	if config.Endpoint != "" {
		go out.flushPeriodically()
	}
	return out
}

const OutputTypeRemoteWrite = "remoteWrite"

func (out *RemoteWriteOutput) Type() string {
	return OutputTypeRemoteWrite
}

func (out *RemoteWriteOutput) flushPeriodically() {
	for range time.NewTicker(15 * time.Second).C {
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

func (out *RemoteWriteOutput) flush(timeSeries []prompb.TimeSeries) error {
	logger.Debug("Remote write flush", "num time series", len(timeSeries))
	remoteWriteData, err := remotewrite.TimeSeriesToBytes(timeSeries)
	if err != nil {
		return fmt.Errorf("error converting time series to bytes: %v", err)
	}
	logger.Debug("Sending to remote write endpoint", "url", out.config.Endpoint, "bodyLength", len(remoteWriteData))
	req, err := http.NewRequest(http.MethodPost, out.config.Endpoint, bytes.NewReader(remoteWriteData))
	if err != nil {
		return fmt.Errorf("error constructing remote write request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-protobuf")
	req.Header.Set("Content-Encoding", "snappy")
	req.Header.Set("X-Prometheus-Remote-Write-Version", "0.1.0")
	req.SetBasicAuth(out.config.User, out.config.Password)

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
	logger.Debug("Successfully sent to remote write endpoint", "url", out.config.Endpoint, "elapsed", time.Since(started))
	return nil
}

func (out *RemoteWriteOutput) Output(_ context.Context, _ OutputVars, frame *data.Frame) ([]*ChannelFrame, error) {
	if out.config.Endpoint == "" {
		logger.Debug("Skip sending to remote write: no url")
		return nil, nil
	}
	ts := remotewrite.TimeSeriesFromFramesLabelsColumn(frame)
	out.mu.Lock()
	out.buffer = append(out.buffer, ts...)
	out.mu.Unlock()
	return nil, nil
}
