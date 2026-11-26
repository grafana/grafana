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
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/writer"
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

func TestMarkerFailureReason(t *testing.T) {
	const activeSeries = `server returned HTTP status 429 Too Many Requests: failed pushing to ingester: the request has been rejected because the tenant exceeded the active series limit (err-mimir-max-active-series)`

	testCases := []struct {
		name   string
		err    error
		reason string
	}{
		{"foreign plain error with the active series id", errors.New(activeSeries), markerReasonMaxActiveSeries},
		{"foreign custom type with the active series id", foreignError{activeSeries}, markerReasonMaxActiveSeries},
		{"wrapped sentinel with the active series id", fmt.Errorf("%w: %s", writer.ErrRateLimited, activeSeries), markerReasonMaxActiveSeries},
		{"another status code with the active series id", errors.Join(writer.ErrUnexpectedWriteFailure, errors.New("HTTP status 503: err-mimir-max-active-series")), markerReasonMaxActiveSeries},
		{"other 429", fmt.Errorf("%w: err-mimir-tenant-max-ingestion-rate", writer.ErrRateLimited), markerReasonRateLimited},
		{"rejected write", fmt.Errorf("%w: label too long", writer.ErrRejectedWrite), markerReasonClientError},
		{"non retryable write", fmt.Errorf("%w: too large", writer.ErrNonRetryableWrite), markerReasonClientError},
		{"unauthorized", fmt.Errorf("%w: nope", writer.ErrDatasourceUnauthorized), markerReasonClientError},
		{"forbidden", fmt.Errorf("%w: nope", writer.ErrDatasourceForbidden), markerReasonClientError},
		{"unmatched 400", errors.Join(writer.ErrUnexpectedWriteFailure, statusError{http.StatusBadRequest}), markerReasonClientError},
		{"500", errors.Join(writer.ErrUnexpectedWriteFailure, statusError{http.StatusInternalServerError}), markerReasonOther},
		{"connection failure", fmt.Errorf("%w: connection refused", writer.ErrConnectionFailure), markerReasonOther},
		{"deadline exceeded", context.DeadlineExceeded, markerReasonOther},
		{"unknown foreign error", foreignError{"boom"}, markerReasonOther},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.reason, markerFailureReason(tc.err))
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
	c := map[string]string{"instance": "c"}

	// b and c go missing on the tick after they were written, and the marker write fails.
	missing := func(t *testing.T, err error) *staleHarness {
		h := newStaleHarness(t)
		h.ev.resp = seriesResponse(a, b, c)
		h.tick()
		h.ev.resp = seriesResponse(a)
		h.failStale, h.staleErr = true, err
		return h
	}
	failures := func(h *staleHarness, reason string) float64 {
		return testutil.ToFloat64(h.rule.metrics.StaleMarkerFailures.WithLabelValues(reason))
	}

	t.Run("a failed write is not retried and its series are forgotten", func(t *testing.T) {
		h := missing(t, foreignError{"temporarily unavailable"})
		h.tick()
		h.tick()
		h.tick()
		require.Equal(t, 1, h.staleAttempts)
		require.Len(t, h.rule.written[seriesTarget{dsUID: "ds-1", orgID: 123, name: "my_metric"}], 1, "only a is still remembered")
	})

	t.Run("failures are counted in series by reason", func(t *testing.T) {
		for reason, err := range map[string]error{
			markerReasonMaxActiveSeries: foreignError{"rejected: err-mimir-max-active-series"},
			markerReasonRateLimited:     fmt.Errorf("%w: slow down", writer.ErrRateLimited),
			markerReasonClientError:     fmt.Errorf("%w: bad label", writer.ErrRejectedWrite),
			markerReasonOther:           foreignError{"boom"},
		} {
			h := missing(t, err)
			h.tick()
			require.Equal(t, 2.0, failures(h, reason), reason+": two series, one failed write")
			require.Equal(t, 1, testutil.CollectAndCount(h.rule.metrics.StaleMarkerFailures), "no other label value appears")
		}
	})

	t.Run("a label value never comes from the error text", func(t *testing.T) {
		h := missing(t, foreignError{"a message with an instance name, instance=a"})
		h.tick()
		require.Equal(t, 1, testutil.CollectAndCount(h.rule.metrics.StaleMarkerFailures))
		require.Equal(t, 2.0, failures(h, markerReasonOther))
	})

	t.Run("every failed write logs, with the reason", func(t *testing.T) {
		h := newStaleHarness(t)
		h.ev.resp = seriesResponse(a, b)
		h.tick()
		h.failStale, h.staleErr = true, foreignError{"err-mimir-max-active-series"}

		logger := &logtest.Fake{}
		h.rule.writeStale(context.Background(), h.now.Add(time.Minute), nil, logger)
		require.Equal(t, 1, logger.WarnLogs.Calls)
		require.Contains(t, logger.WarnLogs.Ctx, markerReasonMaxActiveSeries)
	})

	t.Run("the real writer produces errors that are given the intended reason", func(t *testing.T) {
		for _, tc := range []struct {
			name   string
			status int
			body   string
			reason string
		}{
			{"429 max active series", http.StatusTooManyRequests, `{"status":"error","error":"the request has been rejected because the tenant exceeded the active series limit (err-mimir-max-active-series)"}`, markerReasonMaxActiveSeries},
			{"429 ingestion rate", http.StatusTooManyRequests, `err-mimir-tenant-max-ingestion-rate`, markerReasonRateLimited},
			{"400 expected rejection", http.StatusBadRequest, `err-mimir-label-value-too-long`, markerReasonClientError},
			{"400 anything else", http.StatusBadRequest, `something new`, markerReasonClientError},
			{"403", http.StatusForbidden, `forbidden`, markerReasonClientError},
			{"500", http.StatusInternalServerError, `oops`, markerReasonOther},
			{"503", http.StatusServiceUnavailable, `try later`, markerReasonOther},
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

				require.Equal(t, 1.0, failures(h, tc.reason))
				require.Equal(t, 1, testutil.CollectAndCount(h.rule.metrics.StaleMarkerFailures))
			})
		}
	})
}
