package clientmiddleware

import (
	"context"
	"errors"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"

	"github.com/grafana/grafana/pkg/plugins/backendplugin/chunked"
	"github.com/grafana/grafana/pkg/plugins/instrumentationutils"
)

// Ensure the wrapper forwards the RawChunkReceiver interface so the raw HTTP streaming
// fast path (coreplugin type-asserts the writer to chunked.RawChunkReceiver) is preserved
// through instrumentation. Without this the assertion fails, the raw writer is bypassed,
// and frames are silently dropped.
var _ chunked.RawChunkReceiver = rawErrorRecordingChunkedWriter{}

// errorRecordingChunkedWriter wraps a backend.ChunkedDataWriter to record per-refID
// errors streamed via WriteError. A chunked plugin can report partial failures
// through the writer while returning a nil top-level error (see
// chunked.ProcessTypedResponse), so instrumentation must inspect these streamed
// errors to derive request status the same way QueryData inspects per-refID
// DataResponse errors.
type errorRecordingChunkedWriter struct {
	backend.ChunkedDataWriter

	mu   sync.Mutex
	errs []chunkedRefError
}

type chunkedRefError struct {
	refID  string
	status backend.Status
	err    error
	source backend.ErrorSource
}

func (w *errorRecordingChunkedWriter) WriteError(ctx context.Context, refID string, status backend.Status, err error) error {
	source := backend.ErrorResponseWithErrorSource(err).ErrorSource
	if source == "" && backend.IsDownstreamError(err) {
		source = backend.ErrorSourceDownstream
	}
	w.recordError(refID, status, err, source)
	return w.ChunkedDataWriter.WriteError(ctx, refID, status, err)
}

func (w *errorRecordingChunkedWriter) recordError(refID string, status backend.Status, err error, source backend.ErrorSource) {
	if err == nil {
		return
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	w.errs = append(w.errs, chunkedRefError{refID: refID, status: status, err: err, source: source})
}

// writer returns the writer for the next handler. It implements chunked.RawChunkReceiver
// only when the wrapped writer does, because a client sends raw chunks to each writer
// that implements it, and only decodes the chunks for a writer that does not.
func (w *errorRecordingChunkedWriter) writer() backend.ChunkedDataWriter {
	if raw, ok := w.ChunkedDataWriter.(chunked.RawChunkReceiver); ok {
		return rawErrorRecordingChunkedWriter{errorRecordingChunkedWriter: w, raw: raw}
	}
	return w
}

type rawErrorRecordingChunkedWriter struct {
	*errorRecordingChunkedWriter
	raw chunked.RawChunkReceiver
}

// OnChunk keeps the wrapper transparent to the raw HTTP streaming path: coreplugin
// type-asserts the writer to chunked.RawChunkReceiver and, on success, streams raw
// bytes straight to the HTTP response. In that path per-refID failures arrive as
// chunks carrying an Error rather than via WriteError, so record those here too
// before forwarding, mirroring WriteError.
func (w rawErrorRecordingChunkedWriter) OnChunk(chunk *pluginv2.QueryChunkedDataResponse) error {
	if chunk != nil && chunk.Error != "" {
		w.recordError(chunk.RefId, backend.Status(chunk.Status), errors.New(chunk.Error), backend.ErrorSource(chunk.ErrorSource))
	}
	return w.raw.OnChunk(chunk)
}

// requestStatus derives the overall request status, mirroring
// instrumentationutils.RequestStatusFromQueryDataResponse: a non-nil top-level error
// wins, otherwise the worst streamed per-refID error is used.
func (w *errorRecordingChunkedWriter) requestStatus(err error) instrumentationutils.RequestStatus {
	if err != nil {
		return instrumentationutils.RequestStatusFromError(err)
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	status := instrumentationutils.RequestStatusOK
	for _, e := range w.errs {
		if s := instrumentationutils.RequestStatusFromError(e.err); s > status {
			status = s
			if status == instrumentationutils.RequestStatusError {
				break
			}
		}
	}
	return status
}

// refErrors returns the per-refID errors streamed through WriteError. It must only be
// called after the QueryChunkedData call has returned, when no more writes can occur.
func (w *errorRecordingChunkedWriter) refErrors() []chunkedRefError {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.errs
}
