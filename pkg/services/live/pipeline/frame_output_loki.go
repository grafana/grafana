package pipeline

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const lokiFlushInterval = 15 * time.Second

// LokiFrameOutput can output frame encoded to JSON to Loki.
type LokiFrameOutput struct {
	lokiWriter *lokiWriter
}

func NewLokiFrameOutput(endpoint string, basicAuth *BasicAuth) *LokiFrameOutput {
	return &LokiFrameOutput{
		lokiWriter: newLokiWriter(endpoint, basicAuth),
	}
}

const FrameOutputTypeLoki = "loki"

func (out *LokiFrameOutput) Type() string {
	return FrameOutputTypeLoki
}

type LokiStreamsEntry struct {
	Streams []LokiStream `json:"streams"`
}

type LokiStream struct {
	Stream map[string]string `json:"stream"`
	Values []interface{}     `json:"values"`
}

func (out *LokiFrameOutput) OutputFrame(_ context.Context, vars Vars, frame *data.Frame) ([]*ChannelFrame, error) {
	if out.lokiWriter.endpoint == "" {
		logger.Debug("Skip sending to Loki: no url")
		return nil, nil
	}
	frameJSON, err := data.FrameToJSON(frame, data.IncludeAll)
	if err != nil {
		return nil, err
	}
	err = out.lokiWriter.write(LokiStream{
		Stream: map[string]string{"frame": frame.Name, "channel": vars.Channel},
		Values: []interface{}{
			[]interface{}{time.Now().UnixNano(), string(frameJSON)},
		},
	})
	return nil, err
}

type lokiWriter struct {
	mu         sync.RWMutex
	httpClient *http.Client
	buffer     []LokiStream

	// Endpoint to send streaming frames to.
	endpoint  string
	basicAuth *BasicAuth
}

func newLokiWriter(endpoint string, basicAuth *BasicAuth) *lokiWriter {
	w := &lokiWriter{
		endpoint:  endpoint,
		basicAuth: basicAuth,
		httpClient: &http.Client{
			Timeout: 2 * time.Second,
		},
	}
	go w.flushPeriodically()
	return w
}

func (w *lokiWriter) flushPeriodically() {
	for range time.NewTicker(lokiFlushInterval).C {
		w.mu.Lock()
		if len(w.buffer) == 0 {
			w.mu.Unlock()
			continue
		}
		tmpBuffer := make([]LokiStream, len(w.buffer))
		copy(tmpBuffer, w.buffer)
		w.buffer = nil
		w.mu.Unlock()

		err := w.flush(tmpBuffer)
		if err != nil {
			logger.Error("Error flush to Loki", "error", err)
			w.mu.Lock()
			// TODO: drop in case of large buffer size? Make several attempts only?
			w.buffer = append(tmpBuffer, w.buffer...)
			w.mu.Unlock()
		}
	}
}

func (w *lokiWriter) write(s LokiStream) error {
	w.mu.Lock()
	w.buffer = append(w.buffer, s)
	w.mu.Unlock()
	return nil
}

func (w *lokiWriter) flush(streams []LokiStream) error {
	logger.Debug("Loki flush", "numStreams", len(streams))
	writeData, err := json.Marshal(LokiStreamsEntry{
		Streams: streams,
	})
	if err != nil {
		return fmt.Errorf("error converting Loki stream entry to bytes: %v", err)
	}
	logger.Debug("Sending to Loki endpoint", "url", w.endpoint, "bodyLength", len(writeData))
	req, err := http.NewRequest(http.MethodPost, w.endpoint, bytes.NewReader(writeData))
	if err != nil {
		return fmt.Errorf("error constructing loki push request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if w.basicAuth != nil {
		req.SetBasicAuth(w.basicAuth.User, w.basicAuth.Password)
	}

	started := time.Now()
	resp, err := w.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("error sending to Loki: %w", err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		logger.Error("Unexpected response code from Loki endpoint", "code", resp.StatusCode)
		return errors.New("unexpected response code Loki endpoint")
	}
	logger.Debug("Successfully sent to Loki", "elapsed", time.Since(started))
	return nil
}
