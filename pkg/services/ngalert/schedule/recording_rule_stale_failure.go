package schedule

import (
	"errors"
	"strings"

	"github.com/m3db/prometheus_remote_client_golang/promremote"

	"github.com/grafana/grafana/pkg/services/ngalert/writer"
)

// Reasons a stale marker write fails or a marker is given up on. They are metric label values.
const (
	markerReasonMaxActiveSeries = "max_active_series"
	markerReasonClientError     = "client_error"
	markerReasonTransient       = "transient"
	markerReasonExpired         = "expired"
)

var retryableRejections = []string{
	writer.MimirSampleOutOfOrderError,
	writer.MimirSampleTimestampTooOldError,
	writer.MimirSampleTooFarInPastError,
	writer.MimirSampleTooFarInFutureError,
	writer.MimirIngestionRateLimitedError,
}

type markerFailure struct {
	reason string
	// retry is false when the same marker would be rejected again.
	retry bool
}

// classifyMarkerError decides if a failed marker is worth retrying. The text match comes first
// because writers outside this package may return their own error types.
// Unknown errors are retried, so the age limit is what ends them.
func classifyMarkerError(err error) markerFailure {
	if strings.Contains(err.Error(), writer.MimirMaxActiveSeriesError) {
		return markerFailure{reason: markerReasonMaxActiveSeries}
	}

	// These rejections depend on timing or load, and a retry carries a later timestamp.
	for _, id := range retryableRejections {
		if strings.Contains(err.Error(), id) {
			return markerFailure{reason: markerReasonTransient, retry: true}
		}
	}

	if errors.Is(err, writer.ErrRejectedWrite) ||
		errors.Is(err, writer.ErrNonRetryableWrite) ||
		errors.Is(err, writer.ErrDatasourceUnauthorized) ||
		errors.Is(err, writer.ErrDatasourceForbidden) {
		return markerFailure{reason: markerReasonClientError}
	}

	// 408 and 429 are 4xx but say "try later". A 429 never reaches here with a status,
	// the writer maps it to ErrRateLimited.
	var writeErr promremote.WriteError
	if errors.As(err, &writeErr) {
		if code := writeErr.StatusCode(); code >= 400 && code < 500 && code != 408 && code != 429 {
			return markerFailure{reason: markerReasonClientError}
		}
	}

	return markerFailure{reason: markerReasonTransient, retry: true}
}
