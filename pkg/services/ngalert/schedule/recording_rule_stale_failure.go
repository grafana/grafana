package schedule

import (
	"errors"
	"strings"

	"github.com/m3db/prometheus_remote_client_golang/promremote"

	"github.com/grafana/grafana/pkg/services/ngalert/writer"
)

// Reasons a stale marker write fails. They are metric label values.
const (
	markerReasonMaxActiveSeries = "max_active_series"
	markerReasonRateLimited     = "rate_limited"
	markerReasonClientError     = "client_error"
	markerReasonOther           = "other"
)

// markerFailureReason names why a marker write failed. The text match comes first because
// writers outside this package may return their own error types.
func markerFailureReason(err error) string {
	if strings.Contains(err.Error(), writer.MimirMaxActiveSeriesError) {
		return markerReasonMaxActiveSeries
	}
	if errors.Is(err, writer.ErrRateLimited) {
		return markerReasonRateLimited
	}
	if errors.Is(err, writer.ErrRejectedWrite) ||
		errors.Is(err, writer.ErrNonRetryableWrite) ||
		errors.Is(err, writer.ErrDatasourceUnauthorized) ||
		errors.Is(err, writer.ErrDatasourceForbidden) {
		return markerReasonClientError
	}

	var writeErr promremote.WriteError
	if errors.As(err, &writeErr) {
		if code := writeErr.StatusCode(); code >= 400 && code < 500 {
			return markerReasonClientError
		}
	}
	return markerReasonOther
}
