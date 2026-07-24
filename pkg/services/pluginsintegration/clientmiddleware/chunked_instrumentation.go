package clientmiddleware

import (
	"context"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/plugins/instrumentationutils"
)

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
}

func (w *errorRecordingChunkedWriter) WriteError(ctx context.Context, refID string, status backend.Status, err error) error {
	if err != nil {
		w.mu.Lock()
		w.errs = append(w.errs, chunkedRefError{refID: refID, status: status, err: err})
		w.mu.Unlock()
	}
	return w.ChunkedDataWriter.WriteError(ctx, refID, status, err)
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
