package writer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/dataplane/sdata/numeric"
	"github.com/m3db/prometheus_remote_client_golang/promremote"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const (
	// Network error strings
	networkErrDialTCP           = "dial tcp"
	networkErrConnectionRefused = "connection refused"
	networkErrNoSuchHost        = "no such host"

	// NOTE: Mimir errors were copied from globalerror package:
	// https://github.com/grafana/mimir/blob/1ff367ef58987cd1941de03a8d6923fde82dfdd3/pkg/util/globalerror/user.go
	// Variable names have been standardized as Mimir+{globalerror.ID}+Error for consistency
	// We could consider importing those directly from mimir or moving them to a shared package
	// Other than that, error codes are mapped in errorCauseToHTTPStatusCode (distributor package):
	// https://github.com/grafana/mimir/blob/1ff367ef58987cd1941de03a8d6923fde82dfdd3/pkg/distributor/errors.go#L301-L301
	// The following causes are mapped to Bad Request (400):
	// - mimirpb.TOO_MANY_CLUSTERS:
	// - mimirpb.BAD_DATA:
	// - mimirpb.TENANT_LIMIT:

	// Handler checks for write message size limits
	// https://github.com/grafana/mimir/blob/1ff367ef58987cd1941de03a8d6923fde82dfdd3/pkg/distributor/push.go#L92-L92
	MimirDistributorMaxWriteMessageSizeError         = "err-mimir-distributor-max-write-message-size"
	MimirDistributorMaxWriteRequestDataItemSizeError = "err-mimir-distributor-max-write-request-data-item-size"

	// Distributor.prePushValidationMiddleware calls: 1. validateLabels, 2. validateSamples, 3. validateHistograms,
	// 4. validateExamplars, 5. cleanAndValidateMetadata, then 6. checks for ingestion rate limits
	// 1. validateLabel errors
	// https://github.com/grafana/mimir/blob/1ff367ef58987cd1941de03a8d6923fde82dfdd3/pkg/distributor/validate.go#L402-L402
	MimirInvalidMetricNameError             = "err-mimir-metric-name-invalid"
	MimirMaxLabelNamesPerInfoSeriesError    = "err-mimir-max-label-names-per-info-series"
	MimirMaxLabelNamesPerSeriesError        = "err-mimir-max-label-names-per-series"
	MimirMissingMetricNameError             = "err-mimir-missing-metric-name"
	MimirSeriesInvalidLabelError            = "err-mimir-label-invalid"
	MimirSeriesInvalidLabelValueError       = "err-mimir-label-value-invalid"
	MimirSeriesLabelNameTooLongError        = "err-mimir-label-name-too-long"
	MimirSeriesLabelValueTooLongError       = "err-mimir-label-value-too-long"
	MimirSeriesWithDuplicateLabelNamesError = "err-mimir-duplicate-label-names"

	// 2. validateSamples errors
	MimirSampleTooFarInFutureError = "err-mimir-too-far-in-future"
	MimirSampleTooFarInPastError   = "err-mimir-too-far-in-past"

	// 3. validateHistograms
	MimirInvalidSchemaNativeHistogramError = "err-mimir-invalid-native-histogram-schema"
	MimirMaxNativeHistogramBucketsError    = "err-mimir-max-native-histogram-buckets"
	MimirNotReducibleNativeHistogramError  = "err-mimir-not-reducible-native-histogram"

	// 4. validateExemplars
	MimirExemplarLabelsMissingError    = "err-mimir-exemplar-labels-missing"
	MimirExemplarLabelsTooLongError    = "err-mimir-exemplar-labels-too-long"
	MimirExemplarTimestampInvalidError = "err-mimir-exemplar-timestamp-invalid"

	// 5. cleanAndValidateMetadata errors
	// https://github.com/grafana/mimir/blob/1ff367ef58987cd1941de03a8d6923fde82dfdd3/pkg/distributor/validate.go#L491-L491
	MimirMetricMetadataMetricNameTooLongError = "err-mimir-metric-name-too-long"
	MimirMetricMetadataMissingMetricNameError = "err-mimir-metadata-missing-metric-name"
	MimirMetricMetadataUnitTooLongError       = "err-mimir-unit-too-long"

	// 6. ingestion rate limited error
	// https://github.com/grafana/mimir/blob/1ff367ef58987cd1941de03a8d6923fde82dfdd3/pkg/distributor/distributor.go#L1317-L1317
	// https://github.com/grafana/mimir/blob/1ff367ef58987cd1941de03a8d6923fde82dfdd3/pkg/distributor/distributor.go#L1324-L1324
	MimirIngestionRateLimitedError = "err-mimir-tenant-max-ingestion-rate"

	// Ingester.PushWithCleanup errors
	// https://github.com/grafana/mimir/blob/1ff367ef58987cd1941de03a8d6923fde82dfdd3/pkg/ingester/ingester.go#L1254-L1254
	MimirExemplarSeriesMissingError               = "err-mimir-exemplar-series-missing"
	MimirExemplarTooFarInFutureError              = "err-mimir-exemplar-too-far-in-future"
	MimirExemplarTooFarInPastError                = "err-mimir-exemplar-too-far-in-past"
	MimirMaxMetadataPerMetricError                = "err-mimir-max-metadata-per-metric"
	MimirMaxMetadataPerUserError                  = "err-mimir-max-metadata-per-user"
	MimirMaxSeriesPerMetricError                  = "err-mimir-max-series-per-metric"
	MimirMaxSeriesPerUserError                    = "err-mimir-max-series-per-user"
	MimirNativeHistogramCountMismatchError        = "err-mimir-native-histogram-count-mismatch"
	MimirNativeHistogramCountNotBigEnoughError    = "err-mimir-native-histogram-count-not-big-enough"
	MimirNativeHistogramNegativeBucketCountError  = "err-mimir-native-histogram-negative-bucket-count"
	MimirNativeHistogramOOODisabledError          = "err-mimir-native-histogram-ooo-disabled"
	MimirNativeHistogramSpanNegativeOffsetError   = "err-mimir-native-histogram-span-negative-offset"
	MimirNativeHistogramSpansBucketsMismatchError = "err-mimir-native-histogram-spans-buckets-mismatch"
	MimirSampleDuplicateTimestampError            = "err-mimir-sample-duplicate-timestamp"
	MimirSampleOutOfOrderError                    = "err-mimir-sample-out-of-order"
	MimirSampleTimestampTooOldError               = "err-mimir-sample-timestamp-too-old"
	MimirTooManyHAClustersError                   = "err-mimir-tenant-too-many-ha-clusters"

	// Best effort error messages
	PrometheusDuplicateTimestampError = "duplicate sample for timestamp"

	// returned in some cases when multiple org IDs are present in the request
	MimirErrTooManyOrgIDs = "multiple org IDs present"
)

var (
	// Unexpected, 500-like write errors.
	ErrUnexpectedWriteFailure = errors.New("failed to write time series")
	// Expected, user-level write errors like trying to write an invalid series.
	ErrRejectedWrite          = errors.New("series was rejected")
	ErrBadFrame               = errors.New("failed to read dataframe")
	ErrDatasourceUnauthorized = errors.New("failed to authenticate in datasource")
	ErrDatasourceForbidden    = errors.New("failed to authorize in datasource")
	ErrConnectionFailure      = errors.New("failed to connect to remote write endpoint")

	// IgnoredErrors don't cause the Write to fail, but are still logged.
	IgnoredErrors = []string{
		MimirSampleDuplicateTimestampError,
		PrometheusDuplicateTimestampError,
	}

	// NonRetryableWriteErrors is the deterministic subset of ExpectedErrors: retrying the
	// same payload in-cycle fails identically. The rest stay retryable (may clear over time).
	NonRetryableWriteErrors = []string{
		MimirDistributorMaxWriteMessageSizeError,
		MimirDistributorMaxWriteRequestDataItemSizeError,
	}

	// ExpectedErrors are user-level write errors like trying to write an invalid series.
	ExpectedErrors = []string{
		MimirDistributorMaxWriteMessageSizeError,
		MimirDistributorMaxWriteRequestDataItemSizeError,
		MimirExemplarLabelsMissingError,
		MimirExemplarLabelsTooLongError,
		MimirExemplarSeriesMissingError,
		MimirExemplarTimestampInvalidError,
		MimirExemplarTooFarInFutureError,
		MimirExemplarTooFarInPastError,
		MimirIngestionRateLimitedError,
		MimirInvalidMetricNameError,
		MimirInvalidSchemaNativeHistogramError,
		MimirMaxLabelNamesPerInfoSeriesError,
		MimirMaxLabelNamesPerSeriesError,
		MimirMaxMetadataPerMetricError,
		MimirMaxMetadataPerUserError,
		MimirMaxNativeHistogramBucketsError,
		MimirMaxSeriesPerMetricError,
		MimirMaxSeriesPerUserError,
		MimirMetricMetadataMetricNameTooLongError,
		MimirMetricMetadataMissingMetricNameError,
		MimirMetricMetadataUnitTooLongError,
		MimirMissingMetricNameError,
		MimirNativeHistogramCountMismatchError,
		MimirNativeHistogramCountNotBigEnoughError,
		MimirNativeHistogramNegativeBucketCountError,
		MimirNativeHistogramOOODisabledError,
		MimirNativeHistogramSpanNegativeOffsetError,
		MimirNativeHistogramSpansBucketsMismatchError,
		MimirNotReducibleNativeHistogramError,
		MimirSampleOutOfOrderError,
		MimirSampleTimestampTooOldError,
		MimirSampleTooFarInFutureError,
		MimirSampleTooFarInPastError,
		MimirSeriesInvalidLabelError,
		MimirSeriesInvalidLabelValueError,
		MimirSeriesLabelNameTooLongError,
		MimirSeriesLabelValueTooLongError,
		MimirSeriesWithDuplicateLabelNamesError,
		MimirTooManyHAClustersError,
	}
)

// Metric represents a Prometheus time series metric.
type Metric struct {
	T time.Time
	V float64
}

// Point is a logical representation of a single point in time for a Prometheus time series.
type Point struct {
	Name   string
	Labels map[string]string
	Metric Metric
}

func PointsFromFrames(name string, t time.Time, frames data.Frames, extraLabels map[string]string) ([]Point, error) {
	cr, err := numeric.CollectionReaderFromFrames(frames)
	if err != nil {
		return nil, err
	}

	col, err := cr.GetCollection(false)
	if err != nil {
		return nil, err
	}

	points := make([]Point, 0, len(col.Refs))
	for _, ref := range col.Refs {
		fp, empty, err := ref.NullableFloat64Value()
		if err != nil {
			return nil, fmt.Errorf("unable to read float64 value: %w", err)
		}
		if empty {
			return nil, fmt.Errorf("empty frame")
		}
		if fp == nil {
			return nil, fmt.Errorf("nil frame")
		}

		metric := Metric{
			T: t,
			V: *fp,
		}

		labels := ref.GetLabels().Copy()
		if labels == nil {
			labels = data.Labels{}
		}
		delete(labels, "__name__")
		for k, v := range extraLabels {
			labels[k] = v
		}

		points = append(points, Point{
			Name:   name,
			Labels: labels,
			Metric: metric,
		})
	}

	return points, nil
}

type HttpClientProvider interface {
	New(options ...httpclient.Options) (*http.Client, error)
}

type PrometheusWriter struct {
	client            promremote.Client
	clock             clock.Clock
	logger            log.Logger
	metrics           *metrics.RemoteWriter
	backendType       backendType
	maxBatchSizeBytes int64
}

type PrometheusWriterConfig struct {
	URL         string
	HTTPOptions httpclient.Options
	Timeout     time.Duration
	BackendType backendType
	// MaxBatchSizeBytes is the estimated uncompressed size threshold above which the
	// series in a single Write are split into multiple sequential remote-write requests.
	// A value of 0 disables batching and preserves the original single-request behavior,
	// which is how batching is enabled/disabled per stack.
	//
	// This is a static, manually-tuned threshold. The intended follow-up is to derive it
	// from the target Mimir's configured -distributor.max-recv-msg-size limit so it tracks
	// the backend automatically and doesn't need per-tenant tuning.
	MaxBatchSizeBytes int64
}

func NewPrometheusWriter(
	cfg PrometheusWriterConfig,
	httpClientProvider HttpClientProvider,
	clock clock.Clock,
	l log.Logger,
	metrics *metrics.RemoteWriter,
) (*PrometheusWriter, error) {
	cl, err := httpClientProvider.New(cfg.HTTPOptions)
	if err != nil {
		return nil, err
	}

	clientCfg := promremote.NewConfig(
		promremote.UserAgent("grafana-recording-rule"),
		promremote.WriteURLOption(cfg.URL),
		promremote.HTTPClientTimeoutOption(cfg.Timeout),
		promremote.HTTPClientOption(cl),
	)

	client, err := promremote.NewClient(clientCfg)
	if err != nil {
		return nil, err
	}

	var backend backendType
	if cfg.BackendType != "" {
		backend = cfg.BackendType
	} else {
		backend = prometheusType
	}

	return &PrometheusWriter{
		client:            client,
		clock:             clock,
		logger:            l,
		metrics:           metrics,
		backendType:       backend,
		maxBatchSizeBytes: cfg.MaxBatchSizeBytes,
	}, nil
}

// Write writes the given frames to the Prometheus remote write endpoint.
func (w PrometheusWriter) WriteDatasource(ctx context.Context, dsUID string, name string, t time.Time, frames data.Frames, orgID int64, extraLabels map[string]string) error {
	l := w.logger.FromContext(ctx)

	if dsUID != "" {
		l.Error("Writing to specific data sources is not enabled", "org_id", orgID, "datasource_uid", dsUID)
		return errors.New("writing to specific data sources is not enabled")
	}

	return w.Write(ctx, name, t, frames, orgID, extraLabels)
}

// Write writes the given frames to the Prometheus remote write endpoint.
func (w PrometheusWriter) Write(ctx context.Context, name string, t time.Time, frames data.Frames, orgID int64, extraLabels map[string]string) error {
	l := w.logger.FromContext(ctx)

	points, err := PointsFromFrames(name, t, frames, extraLabels)
	if err != nil {
		return errors.Join(ErrBadFrame, err)
	}

	series := make([]promremote.TimeSeries, 0, len(points))
	for _, p := range points {
		series = append(series, promremote.TimeSeries{
			Labels: promremoteLabelsFromPoint(p),
			Datapoint: promremote.Datapoint{
				Timestamp: p.Metric.T,
				Value:     p.Metric.V,
			},
		})
	}

	l.Debug("Writing metric", "name", name)

	batches := w.batchSeries(series)

	metricLabels := []string{fmt.Sprint(orgID), string(w.backendType)}
	w.metrics.BatchesPerWrite.WithLabelValues(metricLabels...).Observe(float64(len(batches)))

	// Send batches sequentially, attempting all even if some fail. The scheduler retries the
	// whole Write on error; re-sending already-written batches is safe because their
	// duplicate-timestamp errors are ignored (see IgnoredErrors), at the cost of re-POSTing
	// successful batches (bounded by max attempts).
	//
	// errors.Join makes the write non-retryable if any batch is (via errors.Is): a
	// non-retryable batch fails identically every attempt, so retrying can't make the Write
	// succeed this cycle — the rest is re-attempted on the next evaluation.
	var errs []error
	for _, batch := range batches {
		if err := w.writeBatch(ctx, l, orgID, batch); err != nil {
			errs = append(errs, err)
		}
	}

	return errors.Join(errs...)
}

// writeBatch sends a single batch of series and handles metrics and error classification
// exactly as an unbatched write would.
func (w PrometheusWriter) writeBatch(ctx context.Context, l log.Logger, orgID int64, series []promremote.TimeSeries) error {
	lvs := []string{fmt.Sprint(orgID), string(w.backendType)} //nolint:prealloc

	var batchBytes int64
	for _, s := range series {
		batchBytes += estimateSeriesSize(s)
	}
	w.metrics.WriteSizeBytes.WithLabelValues(lvs...).Observe(float64(batchBytes))

	writeStart := w.clock.Now()
	res, writeErr := w.client.WriteTimeSeries(ctx, series, promremote.WriteOptions{})
	w.metrics.WriteDuration.WithLabelValues(lvs...).Observe(w.clock.Now().Sub(writeStart).Seconds())

	lvs = append(lvs, fmt.Sprint(res.StatusCode))
	w.metrics.WritesTotal.WithLabelValues(lvs...).Inc()

	if writeErr != nil {
		if err, ignored := checkWriteError(writeErr); err != nil {
			return err
		} else if ignored {
			l.Debug("Ignored write error", "error", err, "status_code", res.StatusCode)
		}
	}

	return nil
}

// batchSeries splits series into batches each staying under maxBatchSizeBytes. A value of 0
// (or negative) disables batching — all series come back as one batch, preserving the
// original single-request behavior (including empty input) — and is how batching is toggled
// per stack via config.
func (w PrometheusWriter) batchSeries(series []promremote.TimeSeries) [][]promremote.TimeSeries {
	if w.maxBatchSizeBytes <= 0 {
		return [][]promremote.TimeSeries{series}
	}

	batches := make([][]promremote.TimeSeries, 0, 1)
	var (
		batchStart int
		batchBytes int64
	)
	for i, s := range series {
		size := estimateSeriesSize(s)
		// Cut before this series if it would overflow the threshold, but never emit an empty
		// batch: a single oversized series still goes out on its own.
		if i > batchStart && batchBytes+size > w.maxBatchSizeBytes {
			batches = append(batches, series[batchStart:i])
			batchStart = i
			batchBytes = 0
		}
		batchBytes += size
	}
	batches = append(batches, series[batchStart:])

	return batches
}

// Protobuf framing added on top of raw label/sample bytes so the estimate over-approximates
// the encoded size. Each field carries a 1-byte tag; length-delimited fields add a length
// prefix, bounded here at 2 bytes (covers the lengths we emit within Mimir's limits).
const (
	protoTag       = 1
	protoLenPrefix = 2
	protoField     = protoTag + protoLenPrefix // one length-delimited field's framing

	// A label is a nested {name, value} message in a repeated field: framing for the label
	// message plus framing for each of its two string fields.
	labelFramingBytes = protoField + 2*protoField

	// A sample is a nested message holding a fixed64 value and a varint timestamp (each with
	// a tag); add its own field framing and the series' framing within the WriteRequest.
	sampleValueBytes     = 8
	sampleTimestampBytes = 10 // max int64 varint
	sampleFramingBytes   = protoField + 2*protoTag + sampleValueBytes + sampleTimestampBytes + protoField
)

// estimateSeriesSize over-approximates the uncompressed protobuf bytes a series adds to a
// remote-write request; under-counting is the only unsafe direction, so framing is rounded
// up. We don't compute the exact size: the request is snappy-compressed before sending and
// the ratio is data-dependent, but since compressed output never exceeds uncompressed by
// more than snappy's bounded overhead, an uncompressed over-estimate is already a safe bound.
func estimateSeriesSize(s promremote.TimeSeries) int64 {
	size := int64(sampleFramingBytes)
	for _, lbl := range s.Labels {
		size += int64(len(lbl.Name)) + int64(len(lbl.Value)) + labelFramingBytes
	}
	return size
}

func promremoteLabelsFromPoint(point Point) []promremote.Label {
	labels := make([]promremote.Label, 0, len(point.Labels))
	labels = append(labels, promremote.Label{
		Name:  "__name__",
		Value: point.Name,
	})
	for k, v := range point.Labels {
		labels = append(labels, promremote.Label{
			Name:  k,
			Value: v,
		})
	}
	return labels
}

// ErrNonRetryableWrite is an internal marker (matched via errors.Is, never rendered) for a
// deterministic write rejection that fails identically on every in-cycle retry.
var ErrNonRetryableWrite = errors.New("write rejected (non-retryable)")

// nonRetryableWrite tags a rejected write as non-retryable without changing its message;
// errors.Is matches both ErrNonRetryableWrite and the wrapped ErrRejectedWrite.
type nonRetryableWrite struct{ error }

func (nonRetryableWrite) Is(target error) bool { return target == ErrNonRetryableWrite }
func (e nonRetryableWrite) Unwrap() error      { return e.error }

func checkWriteError(writeErr promremote.WriteError) (err error, ignored bool) {
	if writeErr == nil {
		return nil, false
	}

	// Network errors will be in the error string since we can't unwrap
	errString := writeErr.Error()
	if strings.Contains(errString, networkErrDialTCP) ||
		strings.Contains(errString, networkErrConnectionRefused) ||
		strings.Contains(errString, networkErrNoSuchHost) {
		return fmt.Errorf("%w: %v", ErrConnectionFailure, errString), false
	}

	// Most 500-range statuses are automatically unexpected and not the fault of the data.
	if writeErr.StatusCode()/100 == 5 {
		// mimir does return some errors as 500s that should maybe not be considered as such?
		// e.g. `multiple org IDs present`. Handle those separately though to make sure they're treated as exceptions
		if strings.Contains(errString, MimirErrTooManyOrgIDs) {
			return errors.Join(ErrRejectedWrite, writeErr), true
		}
		return errors.Join(ErrUnexpectedWriteFailure, writeErr), false
	}

	// Special case for 400 status code. 400s may be ignorable in the event of HA writers, or the fault of the written data.
	if writeErr.StatusCode() == 400 {
		msg := errString
		// HA may potentially write different values for the same timestamp, so we ignore this error
		// TODO: this may not be needed, further testing needed
		for _, e := range IgnoredErrors {
			if strings.Contains(msg, e) {
				return nil, true
			}
		}

		// Check for deterministic, non-retryable rejections first (a subset of
		// ExpectedErrors). These fail identically on every in-cycle retry.
		for _, e := range NonRetryableWriteErrors {
			if strings.Contains(msg, e) {
				actual := extractActualError(writeErr)
				return nonRetryableWrite{fmt.Errorf("%w: %s", ErrRejectedWrite, actual)}, false
			}
		}

		// Check for expected user errors.
		for _, e := range ExpectedErrors {
			if strings.Contains(msg, e) {
				actual := extractActualError(writeErr)
				return fmt.Errorf("%w: %s", ErrRejectedWrite, actual), false
			}
		}

		// return full error if we don't have a match.'
		return errors.Join(ErrUnexpectedWriteFailure, writeErr), false
	}

	if writeErr.StatusCode() == 401 {
		actual := extractActualError(writeErr)
		return fmt.Errorf("%w: %s", ErrDatasourceUnauthorized, actual), false
	}
	if writeErr.StatusCode() == 403 {
		actual := extractActualError(writeErr)
		return fmt.Errorf("%w: %s", ErrDatasourceForbidden, actual), false
	}

	// All other errors which do not fit into the above categories are also unexpected.
	return errors.Join(ErrUnexpectedWriteFailure, writeErr), false
}

// extractActualError extracts the meaningful error message from a Prometheus remote client error.
// The client includes downstream errors with "body=" prefixes.
// This function parses the content after this prefix, handling both plain text
// and JSON-formatted error messages.
// https://github.com/m3dbx/prometheus_remote_client_golang/blob/master/promremote/client.go#L254-L265
func extractActualError(err promremote.WriteError) string {
	const (
		bodyPrefix    = "body="
		bodyPrefixLen = len(bodyPrefix)
	)

	// Handle nil error case
	if err == nil {
		return ""
	}

	errMsg := err.Error()

	// Find the body content prefix
	bodyIndex := strings.Index(errMsg, bodyPrefix)
	if bodyIndex == -1 {
		return errMsg // Return original if no body prefix found
	}

	// Extract content after "body=" prefix
	bodyContent := strings.TrimSpace(errMsg[bodyIndex+bodyPrefixLen:])
	if bodyContent == "" {
		return errMsg // Return original if body is empty
	}

	// Check if content is possibly a JSON with error field
	if !strings.HasPrefix(bodyContent, "{") || !strings.Contains(bodyContent, "\"error\"") {
		return bodyContent
	}

	// Parse JSON content and extract error field if present
	var errorData struct {
		Error string `json:"error"`
	}

	if err := json.Unmarshal([]byte(bodyContent), &errorData); err != nil {
		return bodyContent
	}

	if errorData.Error == "" {
		return bodyContent
	}

	return errorData.Error
}
