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

var (
	_ RawChunkReceiver          = (*rawChunkWriter)(nil)
	_ backend.ChunkedDataWriter = (*rawChunkWriter)(nil)
)

type rawChunkWriter struct {
	w       http.ResponseWriter
	flusher http.Flusher
}

func NewChunkedHTTPWriter(w http.ResponseWriter) *rawChunkWriter {
	w.Header().Add("Content-Type", CONTENT_TYPE)
	flusher, _ := w.(http.Flusher)
	return &rawChunkWriter{
		w:       w,
		flusher: flusher,
	}
}

// ReceivedChunk implements [backendplugin.RawChunkReceiver].
// Each chunk is one line flushed to the response
func (r *rawChunkWriter) OnChunk(chunk *pluginv2.QueryChunkedDataResponse) error {
	b, _ := json.Marshal(chunk.RefId)
	_, _ = r.w.Write([]byte(`{"refId":`))
	_, _ = r.w.Write(b) // escaped RefID

	if chunk.FrameId != "" {
		r.writeField("frameId", chunk.FrameId)
	}

	if chunk.Frame != nil {
		// Ensure the frame is in JSON, convert it from arrow if necessary
		if chunk.Format != pluginv2.DataFrameFormat_JSON {
			tmp, err := data.UnmarshalArrowFrame(chunk.Frame)
			if err != nil {
				return fmt.Errorf("failed to unmarshal frame: %w", err)
			}
			chunk.Frame, err = tmp.MarshalJSON()
			if err != nil {
				return fmt.Errorf("failed to marshal frame to JSON: %w", err)
			}
		}

		_, _ = r.w.Write([]byte(`,"frame":`))
		_, _ = r.w.Write(chunk.Frame) // raw JSON bytes
	}

	if chunk.Error != "" {
		r.writeField("error", chunk.Error)

		if chunk.ErrorSource != "" {
			r.writeField("errorSource", chunk.ErrorSource)
		}
	}

	if _, err := r.w.Write([]byte("}\n")); err != nil {
		return err
	}

	if r.flusher != nil {
		r.flusher.Flush()
	}
	return nil
}

func (r *rawChunkWriter) writeField(f string, v string) {
	b, _ := json.Marshal(v)
	_, _ = r.w.Write([]byte(`,"` + f + `":`))
	_, _ = r.w.Write(b)
}

// WriteError implements [backend.ChunkedDataWriter].
func (r *rawChunkWriter) WriteError(ctx context.Context, refID string, status backend.Status, err error) error {
	return fmt.Errorf("rawChunkWriter does not support: WriteError")
}

// WriteFrame implements [backend.ChunkedDataWriter].
func (r *rawChunkWriter) WriteFrame(ctx context.Context, refID string, frameID string, f *data.Frame) error {
	return fmt.Errorf("rawChunkWriter does not support: WriteFrame")
}
