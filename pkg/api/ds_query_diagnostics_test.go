package api

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/datasources"
)

// TestDiagnosticsNoCaptureError guards the status mapping used when a query fails and no HAR was
// captured: a per-refId (bad-query) failure must surface as 400 like QueryMetricsV2, NOT 500, while
// top-level errors keep their typed status.
func TestDiagnosticsNoCaptureError(t *testing.T) {
	hs := &HTTPServer{}

	t.Run("per-refId failure is a client error (400), not 500", func(t *testing.T) {
		r := hs.diagnosticsNoCaptureError(nil, errors.New("bad promql"))
		require.NotNil(t, r)
		require.Equal(t, http.StatusBadRequest, r.Status())
	})

	t.Run("generic top-level error is 500", func(t *testing.T) {
		r := hs.diagnosticsNoCaptureError(errors.New("boom"), nil)
		require.Equal(t, http.StatusInternalServerError, r.Status())
	})

	t.Run("typed top-level errors keep their status", func(t *testing.T) {
		require.Equal(t, http.StatusForbidden,
			hs.diagnosticsNoCaptureError(datasources.ErrDataSourceAccessDenied, nil).Status())
		require.Equal(t, http.StatusNotFound,
			hs.diagnosticsNoCaptureError(datasources.ErrDataSourceNotFound, nil).Status())
	})

	t.Run("top-level error takes precedence over per-refId", func(t *testing.T) {
		r := hs.diagnosticsNoCaptureError(errors.New("boom"), errors.New("bad promql"))
		require.Equal(t, http.StatusInternalServerError, r.Status())
	})

	t.Run("no failure proceeds to bundle assembly (nil)", func(t *testing.T) {
		require.Nil(t, hs.diagnosticsNoCaptureError(nil, nil))
	})
}
