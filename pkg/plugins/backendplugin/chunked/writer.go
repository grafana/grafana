package chunked

import (
	"context"
	"fmt"
	"net/http"

	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

func IsRequestingChunkedResponse(accept string) bool {
	return accept == "text/event-stream"
}

var (
	_ RawChunkReceiver          = (*rawChunkWriter)(nil)
	_ backend.ChunkedDataWriter = (*rawChunkWriter)(nil)
)

type rawChunkWriter struct {
	stream *jsoniter.Stream
}

func NewHTTPWriter(w http.ResponseWriter) *rawChunkWriter {
	return &rawChunkWriter{
		stream: jsoniter.NewStream(jsoniter.ConfigCompatibleWithStandardLibrary, w, 1024*10),
	}
}

// ReceivedChunk implements [backendplugin.RawChunkReceiver].
func (r *rawChunkWriter) OnChunk(chunk *pluginv2.QueryChunkedDataResponse) error {
	if chunk.Format != pluginv2.DataFrameFormat_JSON {
		return fmt.Errorf("expected json format")
	}

	r.stream.WriteRaw("data: ")
	r.stream.WriteObjectStart()
	r.stream.WriteObjectField("refId")
	r.stream.WriteString(chunk.RefId)

	if chunk.FrameId != "" {
		r.stream.WriteMore()
		r.stream.WriteObjectField("frameId")
		r.stream.WriteString(chunk.FrameId)
	}

	if chunk.Frame != nil {
		r.stream.WriteMore()
		r.stream.WriteObjectField("frame")
		r.stream.WriteRaw(string(chunk.Frame)) // must not contain newlines!
	}

	if chunk.Error != "" {
		r.stream.WriteMore()
		r.stream.WriteObjectField("error")
		r.stream.WriteString(chunk.Error)

		if chunk.ErrorSource != "" {
			r.stream.WriteMore()
			r.stream.WriteObjectField("errorSource")
			r.stream.WriteString(chunk.ErrorSource)
		}
	}

	r.stream.WriteObjectEnd()
	r.stream.WriteRaw("\n\n") // marks the end of a message in SSE
	return r.stream.Flush()
}

// WriteError implements [backend.ChunkedDataWriter].
func (r *rawChunkWriter) WriteError(ctx context.Context, refID string, status backend.Status, err error) error {
	return fmt.Errorf("unexpected callback (WriteError)")
}

// WriteFrame implements [backend.ChunkedDataWriter].
func (r *rawChunkWriter) WriteFrame(ctx context.Context, refID string, frameID string, f *data.Frame) error {
	return fmt.Errorf("unexpected callback (WriteFrame)")
}
