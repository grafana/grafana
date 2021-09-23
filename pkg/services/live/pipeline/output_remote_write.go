package pipeline

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/live/remotewrite"
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
	config     RemoteWriteConfig
	httpClient *http.Client
}

func NewRemoteWriteOutput(config RemoteWriteConfig) *RemoteWriteOutput {
	return &RemoteWriteOutput{
		config:     config,
		httpClient: &http.Client{Timeout: 2 * time.Second},
	}
}

const OutputTypeRemoteWrite = "remoteWrite"

func (out *RemoteWriteOutput) Type() string {
	return OutputTypeRemoteWrite
}

func (out *RemoteWriteOutput) Output(_ context.Context, _ OutputVars, frame *data.Frame) ([]*ChannelFrame, error) {
	if out.config.Endpoint == "" {
		logger.Debug("Skip sending to remote write: no url")
		return nil, nil
	}

	// Use remote write for a stream.
	remoteWriteData, err := remotewrite.SerializeLabelsColumn(frame)
	if err != nil {
		logger.Error("Error serializing to remote write format", "error", err)
		return nil, err
	}

	logger.Debug("Sending to remote write endpoint", "url", out.config.Endpoint, "bodyLength", len(remoteWriteData))
	req, err := http.NewRequest(http.MethodPost, out.config.Endpoint, bytes.NewReader(remoteWriteData))
	if err != nil {
		logger.Error("Error constructing remote write request", "error", err)
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-protobuf")
	req.Header.Set("Content-Encoding", "snappy")
	req.Header.Set("X-Prometheus-Remote-Write-Version", "0.1.0")
	req.SetBasicAuth(out.config.User, out.config.Password)

	started := time.Now()
	resp, err := out.httpClient.Do(req)
	if err != nil {
		logger.Error("Error sending remote write request", "error", err)
		return nil, err
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		logger.Error("Unexpected response code from remote write endpoint", "code", resp.StatusCode)
		return nil, errors.New("unexpected response code from remote write endpoint")
	}
	logger.Debug("Successfully sent to remote write endpoint", "url", out.config.Endpoint, "elapsed", time.Since(started))
	return nil, nil
}
