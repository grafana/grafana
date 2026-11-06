package chunked

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

const CONTENT_TYPE = "text/jsonl"

func IsRequestingChunkedResponse(accept string) bool {
	return slices.Contains(strings.FieldsFunc(accept, func(r rune) bool {
		return r == ';' || r == ',' || r == ' '
	}), CONTENT_TYPE)
}

// Event carries frame data, a per-query error, or a stream record.
// A nonempty frameId identifies a frame within refId: subsequent chunks append
// rows and omit the schema, following the SDK ChunkedDataWriter contract.
// Only a complete record followed by EOF denotes successful stream completion.
type Event struct {
	Type        string          `json:"type,omitempty"`
	RefID       string          `json:"refId,omitempty"`
	FrameID     string          `json:"frameId,omitempty"`
	Frame       json.RawMessage `json:"frame,omitempty"`
	Status      int32           `json:"status,omitempty"`
	Error       string          `json:"error,omitempty"`
	ErrorSource string          `json:"errorSource,omitempty"`
}

var (
	_ RawChunkReceiver          = (*rawChunkWriter)(nil)
	_ backend.ChunkedDataWriter = (*rawChunkWriter)(nil)
)

type rawChunkWriter struct {
	w        http.ResponseWriter
	flusher  http.Flusher
	started  bool
	finished bool
}

func NewChunkedHTTPWriter(w http.ResponseWriter) *rawChunkWriter {
	w.Header().Set("Content-Type", CONTENT_TYPE)
	flusher, _ := w.(http.Flusher)
	return &rawChunkWriter{w: w, flusher: flusher}
}

func (r *rawChunkWriter) Started() bool { return r.started }

func (r *rawChunkWriter) writeEvent(event Event) error {
	if r.finished {
		return fmt.Errorf("chunked query stream has already finished")
	}
	b, err := json.Marshal(event)
	if err != nil {
		return err
	}
	r.started = true
	if _, err = r.w.Write(append(b, '\n')); err != nil {
		return err
	}
	if r.flusher != nil {
		r.flusher.Flush()
	}
	return nil
}

func (r *rawChunkWriter) OnChunk(chunk *pluginv2.QueryChunkedDataResponse) error {
	frame := chunk.Frame
	if frame != nil && chunk.Format != pluginv2.DataFrameFormat_JSON {
		f, err := data.UnmarshalArrowFrame(frame)
		if err != nil {
			return fmt.Errorf("failed to unmarshal frame: %w", err)
		}
		frame, err = f.MarshalJSON()
		if err != nil {
			return fmt.Errorf("failed to marshal frame to JSON: %w", err)
		}
	}
	return r.writeEvent(Event{RefID: chunk.RefId, FrameID: chunk.FrameId, Frame: frame,
		Status: chunk.Status, Error: chunk.Error, ErrorSource: chunk.ErrorSource})
}

func (r *rawChunkWriter) Complete() error {
	err := r.writeEvent(Event{Type: "complete"})
	r.finished = true
	return err
}

func (r *rawChunkWriter) WriteStreamError(err error) error {
	writeErr := r.writeEvent(Event{Type: "error", Error: err.Error()})
	r.finished = true
	return writeErr
}

func (r *rawChunkWriter) WriteError(ctx context.Context, refID string, status backend.Status, err error) error {
	return fmt.Errorf("rawChunkWriter does not support: WriteError")
}

func (r *rawChunkWriter) WriteFrame(ctx context.Context, refID string, frameID string, f *data.Frame) error {
	return fmt.Errorf("rawChunkWriter does not support: WriteFrame")
}
