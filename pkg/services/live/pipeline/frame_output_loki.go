package pipeline

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// LokiFrameOutputConfig ...
type LokiFrameOutputConfig struct{}

// LokiFrameOutput passes processing control to the rule defined
// for a configured channel.
type LokiFrameOutput struct {
	config     LokiFrameOutputConfig
	httpClient *http.Client
}

func NewLokiFrameOutput(config LokiFrameOutputConfig) *LokiFrameOutput {
	return &LokiFrameOutput{
		config:     config,
		httpClient: &http.Client{Timeout: 2 * time.Second},
	}
}

const FrameOutputTypeLoki = "loki"

func (out *LokiFrameOutput) Type() string {
	return FrameOutputTypeLoki
}

func outputLoki(httpClient *http.Client, logLine string, labels map[string]string) error {
	entries := map[string]interface{}{
		"streams": []interface{}{
			map[string]interface{}{
				"stream": labels,
				"values": []interface{}{
					[]interface{}{time.Now().UnixNano(), logLine},
				},
			},
		},
	}
	payload, err := json.Marshal(entries)
	if err != nil {
		return err
	}
	logger.Debug("Sending data to Loki", "bodyLength", len(payload))
	req, err := http.NewRequest(http.MethodPost, "http://127.0.0.1:3100/loki/api/v1/push", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("error constructing loki push request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	//req.SetBasicAuth(out.config.User, out.config.Password)

	started := time.Now()
	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("error sending to Loki: %w", err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		logger.Error("Unexpected response code from remote write endpoint", "code", resp.StatusCode)
		return errors.New("unexpected response code from remote write endpoint")
	}
	logger.Debug("Successfully sent to Loki", "elapsed", time.Since(started))
	return nil
}

func (out *LokiFrameOutput) OutputFrame(_ context.Context, vars Vars, frame *data.Frame) ([]*ChannelFrame, error) {
	frameJSON, err := data.FrameToJSON(frame, data.IncludeAll)
	if err != nil {
		return nil, err
	}
	err = outputLoki(out.httpClient, string(frameJSON), map[string]string{"host": "test"})
	return nil, err
}
