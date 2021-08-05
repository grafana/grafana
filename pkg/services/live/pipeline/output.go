package pipeline

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/grafana/grafana/pkg/services/live/remotewrite"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type Outputter interface {
	Output(ctx context.Context, vars OutputVars, frame *data.Frame) error
}

type RemoteWriteConfig struct {
	// Enabled to enable remote write for a channel.
	Enabled bool
	// Endpoint to send streaming frames to.
	Endpoint string
	// User is a user for remote write request.
	User string
	// Password ...
	Password string
	// SampleMilliseconds allow setting minimal time before
	// different remote writes for a channel. 0 means no sampling interval.
	SampleMilliseconds int64
}

type RemoteWriteOutput struct {
	config     RemoteWriteConfig
	httpClient *http.Client
}

func NewRemoteWriteOutput(config RemoteWriteConfig) *RemoteWriteOutput {
	return &RemoteWriteOutput{
		config:     config,
		httpClient: &http.Client{Timeout: 2 * time.Second},
	}
}

func (r RemoteWriteOutput) Output(ctx context.Context, vars OutputVars, frame *data.Frame) error {
	if r.config.Endpoint == "" {
		logger.Debug("Skip sending to remote write: no url")
		return nil
	}

	// Use remote write for a stream.
	remoteWriteData, err := remotewrite.SerializeLabelsColumn(frame)
	if err != nil {
		logger.Error("Error serializing to remote write format", "error", err)
		return err
	}

	logger.Debug("Sending to remote write endpoint", "url", r.config.Endpoint, "bodyLength", len(remoteWriteData))
	req, err := http.NewRequest(http.MethodPost, r.config.Endpoint, bytes.NewReader(remoteWriteData))
	if err != nil {
		logger.Error("Error constructing remote write request", "error", err)
		return err
	}
	req.Header.Set("Content-Type", "application/x-protobuf")
	req.Header.Set("Content-Encoding", "snappy")
	req.Header.Set("X-Prometheus-Remote-Write-Version", "0.1.0")
	req.SetBasicAuth(r.config.User, r.config.Password)

	started := time.Now()
	resp, err := r.httpClient.Do(req)
	if err != nil {
		logger.Error("Error sending remote write request", "error", err)
		return err
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		logger.Error("Unexpected response code from remote write endpoint", "code", resp.StatusCode)
		return errors.New("unexpected response code from remote write endpoint")
	}
	logger.Debug("Successfully sent to remote write endpoint", "url", r.config.Endpoint, "elapsed", time.Since(started))
	return nil
}
