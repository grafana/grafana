package schedule

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/m3db/prometheus_remote_client_golang/promremote"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/writer"
	"github.com/grafana/grafana/pkg/setting"
)

type foreignError struct{ msg string }

func (e foreignError) Error() string { return e.msg }

type statusError struct{ code int }

func (e statusError) Error() string     { return fmt.Sprintf("status %d", e.code) }
func (e statusError) StatusCode() int   { return e.code }
func (e statusError) Data() []byte      { return nil }
func (e statusError) Unwrap() error     { return nil }
func (e statusError) IsRetryable() bool { return false }
func (e statusError) Is(error) bool     { return false }
func (e statusError) Timeout() bool     { return false }
func (e statusError) Temporary() bool   { return false }

var _ promremote.WriteError = statusError{}

type statusErrorWithText struct {
	code int
	text string
}

func (e statusErrorWithText) Error() string     { return e.text }
func (e statusErrorWithText) StatusCode() int   { return e.code }
func (e statusErrorWithText) Data() []byte      { return nil }
func (e statusErrorWithText) Unwrap() error     { return nil }
func (e statusErrorWithText) IsRetryable() bool { return false }
func (e statusErrorWithText) Is(error) bool     { return false }
func (e statusErrorWithText) Timeout() bool     { return false }
func (e statusErrorWithText) Temporary() bool   { return false }

var _ promremote.WriteError = statusErrorWithText{}

func TestClassifyMarkerError(t *testing.T) {
	const activeSeries = `server returned HTTP status 429 Too Many Requests: failed pushing to ingester: the request has been rejected because the tenant exceeded the active series limit (err-mimir-max-active-series)`

	testCases := []struct {
		name   string
		err    error
		reason string
		retry  bool
	}{
		{"foreign plain error with the active series id", errors.New(activeSeries), markerReasonMaxActiveSeries, false},
		{"foreign custom type with the active series id", foreignError{activeSeries}, markerReasonMaxActiveSeries, false},
		{"wrapped sentinel with the active series id", fmt.Errorf("%w: %s", writer.ErrRateLimited, activeSeries), markerReasonMaxActiveSeries, false},
		{"another status code with the active series id", errors.Join(writer.ErrUnexpectedWriteFailure, errors.New("HTTP status 503: err-mimir-max-active-series")), markerReasonMaxActiveSeries, false},
		{"rejected write", fmt.Errorf("%w: label too long", writer.ErrRejectedWrite), markerReasonClientError, false},
		{"rejected as out of order", fmt.Errorf("%w: err-mimir-sample-out-of-order", writer.ErrRejectedWrite), markerReasonTransient, true},
		{"rejected as too old", fmt.Errorf("%w: err-mimir-sample-timestamp-too-old", writer.ErrRejectedWrite), markerReasonTransient, true},
		{"rejected as too far in the past", fmt.Errorf("%w: err-mimir-too-far-in-past", writer.ErrRejectedWrite), markerReasonTransient, true},
		{"rejected as too far in the future is dropped", fmt.Errorf("%w: err-mimir-too-far-in-future", writer.ErrRejectedWrite), markerReasonClientError, false},
		{"prometheus out of order", errors.Join(writer.ErrUnexpectedWriteFailure, statusErrorWithText{400, "out of order sample"}), markerReasonTransient, true},
		{"prometheus out of bounds", errors.Join(writer.ErrUnexpectedWriteFailure, statusErrorWithText{400, "out of bounds"}), markerReasonTransient, true},
		{"prometheus too far in the future is dropped", errors.Join(writer.ErrUnexpectedWriteFailure, statusErrorWithText{400, "out of bounds: timestamp is too far in the future"}), markerReasonClientError, false},
		{"non retryable write", fmt.Errorf("%w: too large", writer.ErrNonRetryableWrite), markerReasonClientError, false},
		{"unauthorized", fmt.Errorf("%w: nope", writer.ErrDatasourceUnauthorized), markerReasonClientError, false},
		{"forbidden", fmt.Errorf("%w: nope", writer.ErrDatasourceForbidden), markerReasonClientError, false},
		{"unmatched 400", errors.Join(writer.ErrUnexpectedWriteFailure, statusError{http.StatusBadRequest}), markerReasonClientError, false},
		{"other 429 such as the ingestion rate", fmt.Errorf("%w: err-mimir-tenant-max-ingestion-rate", writer.ErrRateLimited), markerReasonTransient, true},
		{"408", errors.Join(writer.ErrUnexpectedWriteFailure, statusError{http.StatusRequestTimeout}), markerReasonTransient, true},
		{"500", errors.Join(writer.ErrUnexpectedWriteFailure, statusError{http.StatusInternalServerError}), markerReasonTransient, true},
		{"connection failure", fmt.Errorf("%w: connection refused", writer.ErrConnectionFailure), markerReasonTransient, true},
		{"deadline exceeded", context.DeadlineExceeded, markerReasonTransient, true},
		{"unknown foreign error", foreignError{"boom"}, markerReasonTransient, true},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got := classifyMarkerError(tc.err)
			require.Equal(t, tc.reason, got.reason)
			require.Equal(t, tc.retry, got.retry)
		})
	}
}

type staticClientProvider struct{}

func (staticClientProvider) New(...sdkhttpclient.Options) (*http.Client, error) {
	return &http.Client{}, nil
}

// remoteStaleWriter sends markers through the real Prometheus writer to a test server.
type remoteStaleWriter struct {
	writer.FakeWriter
	w *writer.PrometheusWriter
}

func (r *remoteStaleWriter) WriteDatasource(context.Context, string, string, time.Time, data.Frames, int64, map[string]string) error {
	return nil
}

func (r *remoteStaleWriter) WriteStale(ctx context.Context, _ string, name string, ts time.Time, orgID int64, labelSets []map[string]string) error {
	return r.w.WriteStale(ctx, name, ts, orgID, labelSets)
}

func TestRecordingRuleStaleMarkerFailures(t *testing.T) {
	a := map[string]string{"instance": "a"}
	b := map[string]string{"instance": "b"}

	// h has series a and b written, then b goes missing on the next tick.
	missingB := func(t *testing.T) *staleHarness {
		h := newStaleHarness(t)
		h.ev.resp = seriesResponse(a, b)
		h.tick()
		h.ev.resp = seriesResponse(a)
		h.failStale = true
		return h
	}

	t.Run("max active series is dropped at once, whatever the error type", func(t *testing.T) {
		for name, err := range map[string]error{
			"plain":   errors.New("HTTP status 429: err-mimir-max-active-series"),
			"foreign": foreignError{"rejected: err-mimir-max-active-series"},
		} {
			t.Run(name, func(t *testing.T) {
				h := missingB(t)
				h.staleErr = err
				h.tick()
				require.Equal(t, 1, h.staleAttempts, "one attempt at the first missing tick")
				require.Empty(t, h.rule.failedAt)

				h.tick()
				h.tick()
				require.Equal(t, 1, h.staleAttempts, "never tried again")
				require.Len(t, h.rule.written[seriesTarget{dsUID: "ds-1", orgID: 123, name: "my_metric"}], 1, "only a is still tracked")
			})
		}
	})

	t.Run("a client error is dropped at once and a transient error is retried", func(t *testing.T) {
		h := missingB(t)
		h.staleErr = fmt.Errorf("%w: bad label", writer.ErrRejectedWrite)
		h.tick()
		h.tick()
		require.Equal(t, 1, h.staleAttempts)

		h = missingB(t)
		h.staleErr = errors.Join(writer.ErrUnexpectedWriteFailure, statusError{http.StatusInternalServerError})
		h.tick()
		h.tick()
		require.Equal(t, 2, h.staleAttempts, "retried on the next tick")
	})

	t.Run("a transient failure is retried within the age and dropped after it", func(t *testing.T) {
		h := missingB(t)
		h.rule.cfg.StaleMarkerMaxAge = 3 * time.Minute
		h.staleErr = foreignError{"temporarily unavailable"}

		start := h.staleAttempts
		for range 3 {
			h.tick()
		}
		require.Equal(t, 3, h.staleAttempts-start, "ticks at 0, 1 and 2 minutes after the first failure retry")
		require.NotEmpty(t, h.rule.failedAt)

		h.tick()
		require.Equal(t, 3, h.staleAttempts-start, "at the age limit the marker is not written")
		require.Empty(t, h.rule.failedAt)
		require.Len(t, h.rule.written[seriesTarget{dsUID: "ds-1", orgID: 123, name: "my_metric"}], 1, "b is forgotten")

		h.tick()
		require.Equal(t, 3, h.staleAttempts-start, "and never again")
	})

	t.Run("a zero age setting uses the default, as the settings built by hand elsewhere do", func(t *testing.T) {
		h := missingB(t)
		require.Zero(t, h.rule.cfg.StaleMarkerMaxAge)
		require.Equal(t, 10*time.Minute, setting.DefaultStaleMarkerMaxAge)
		h.staleErr = foreignError{"temporarily unavailable"}

		start := h.staleAttempts
		for range 9 {
			h.tick()
		}
		require.Equal(t, 9, h.staleAttempts-start, "still retried 8 minutes after the first failure")

		h.tick()
		require.Equal(t, 10, h.staleAttempts-start, "the tick 9 minutes after the first failure retries too")
		h.tick()
		require.Equal(t, 10, h.staleAttempts-start, "dropped at 10 minutes")
		require.Empty(t, h.rule.failedAt)
	})

	t.Run("the age limit also ends the retries when the data write keeps failing", func(t *testing.T) {
		h := missingB(t)
		h.rule.cfg.StaleMarkerMaxAge = 2 * time.Minute
		h.staleErr = foreignError{"temporarily unavailable"}
		h.failWrite = true

		start := h.staleAttempts
		for range 5 {
			h.tick()
		}
		require.Equal(t, 2, h.staleAttempts-start)
	})

	t.Run("a series that comes back clears its first failure time", func(t *testing.T) {
		h := missingB(t)
		h.rule.cfg.StaleMarkerMaxAge = 3 * time.Minute
		h.staleErr = foreignError{"temporarily unavailable"}
		h.tick()
		h.tick()
		require.NotEmpty(t, h.rule.failedAt)

		h.ev.resp = seriesResponse(a, b)
		h.tick()
		require.Empty(t, h.rule.failedAt, "b is output again")

		// b goes missing again: the clock for its retries starts over.
		h.ev.resp = seriesResponse(a)
		start := h.staleAttempts
		for range 3 {
			h.tick()
		}
		require.Equal(t, 3, h.staleAttempts-start)
	})

	t.Run("a failure only keeps the series of its own target", func(t *testing.T) {
		h := missingB(t)
		h.staleErr = foreignError{"temporarily unavailable"}
		h.tick()
		h.failStale = false
		h.tick()
		require.Empty(t, h.rule.failedAt, "a successful retry clears it")
		require.Len(t, h.stale, 1)
	})

	t.Run("the real writer produces errors that are classified as intended", func(t *testing.T) {
		for _, tc := range []struct {
			name     string
			status   int
			body     string
			attempts int
		}{
			{"429 max active series", http.StatusTooManyRequests, `{"status":"error","error":"the request has been rejected because the tenant exceeded the active series limit (err-mimir-max-active-series)"}`, 1},
			{"400 expected rejection", http.StatusBadRequest, `err-mimir-label-value-too-long`, 1},
			{"400 anything else", http.StatusBadRequest, `something new`, 1},
			{"400 out of order", http.StatusBadRequest, `err-mimir-sample-out-of-order`, 2},
			{"400 too far in the future", http.StatusBadRequest, `err-mimir-too-far-in-future`, 1},
			{"400 prometheus out of order", http.StatusBadRequest, `out of order sample`, 2},
			{"400 prometheus out of bounds", http.StatusBadRequest, `out of bounds`, 2},
			{"400 prometheus too far in the future", http.StatusBadRequest, `out of bounds: timestamp is too far in the future`, 1},
			{"403", http.StatusForbidden, `forbidden`, 1},
			{"429 ingestion rate", http.StatusTooManyRequests, `err-mimir-tenant-max-ingestion-rate`, 2},
			{"500", http.StatusInternalServerError, `oops`, 2},
			{"503", http.StatusServiceUnavailable, `try later`, 2},
		} {
			t.Run(tc.name, func(t *testing.T) {
				srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.WriteHeader(tc.status)
					_, _ = w.Write([]byte(tc.body))
				}))
				t.Cleanup(srv.Close)

				pw, err := writer.NewPrometheusWriter(
					writer.PrometheusWriterConfig{URL: srv.URL, Timeout: time.Second},
					staticClientProvider{}, clock.New(), log.NewNopLogger(), metrics.NewRemoteWriterMetrics(prometheus.NewRegistry()),
				)
				require.NoError(t, err)

				h := newStaleHarness(t)
				h.ev.resp = seriesResponse(a, b)
				h.tick()
				h.rule.writer = &remoteStaleWriter{w: pw}
				h.ev.resp = seriesResponse(a)
				h.tick()
				h.tick()

				retried := len(h.rule.failedAt) > 0
				require.Equal(t, tc.attempts == 2, retried)
			})
		}
	})
}

func TestRecordingRuleStaleMarkerMetrics(t *testing.T) {
	a := map[string]string{"instance": "a"}
	b := map[string]string{"instance": "b"}
	c := map[string]string{"instance": "c"}

	counts := func(h *staleHarness) (failures, dropped map[string]float64) {
		failures, dropped = map[string]float64{}, map[string]float64{}
		for _, reason := range []string{markerReasonMaxActiveSeries, markerReasonClientError, markerReasonTransient, markerReasonExpired} {
			failures[reason] = testutil.ToFloat64(h.rule.metrics.StaleMarkerFailures.WithLabelValues(reason))
			dropped[reason] = testutil.ToFloat64(h.rule.metrics.StaleMarkersDropped.WithLabelValues(reason))
		}
		return failures, dropped
	}

	// Two series go missing on the first tick after being written.
	setup := func(t *testing.T, err error) *staleHarness {
		h := newStaleHarness(t)
		h.rule.cfg.StaleMarkerMaxAge = 2 * time.Minute
		h.ev.resp = seriesResponse(a, b, c)
		h.tick()
		h.ev.resp = seriesResponse(a)
		h.failStale = true
		h.staleErr = err
		return h
	}

	t.Run("a marker rejected for good counts as a failure and a drop with the same reason", func(t *testing.T) {
		for reason, err := range map[string]error{
			markerReasonMaxActiveSeries: foreignError{"err-mimir-max-active-series"},
			markerReasonClientError:     fmt.Errorf("%w: bad label", writer.ErrRejectedWrite),
		} {
			h := setup(t, err)
			h.tick()
			h.tick()
			failures, dropped := counts(h)
			require.Equal(t, 2.0, failures[reason], "two series, one failed write, counted once")
			require.Equal(t, 2.0, dropped[reason])
			for other := range failures {
				if other != reason {
					require.Zero(t, failures[other]+dropped[other], other)
				}
			}
		}
	})

	t.Run("a transient failure counts on every try and is dropped as expired after the age", func(t *testing.T) {
		h := setup(t, foreignError{"temporarily unavailable"})
		h.tick()
		h.tick()
		failures, dropped := counts(h)
		require.Equal(t, 4.0, failures[markerReasonTransient], "two series on two ticks")
		require.Zero(t, dropped[markerReasonTransient], "a retried marker is not dropped")
		require.Zero(t, dropped[markerReasonExpired])

		h.tick()
		failures, dropped = counts(h)
		require.Equal(t, 4.0, failures[markerReasonTransient], "no write at the age limit")
		require.Equal(t, 2.0, dropped[markerReasonExpired])
	})

	t.Run("label values stay in the fixed set", func(t *testing.T) {
		h := setup(t, foreignError{"a message with an instance name, instance=a"})
		h.tick()
		require.Equal(t, 1, testutil.CollectAndCount(h.rule.metrics.StaleMarkerFailures))
		require.Zero(t, testutil.CollectAndCount(h.rule.metrics.StaleMarkersDropped), "nothing dropped yet")
	})
}
