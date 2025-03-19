package writer

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/dataplane/sdata/numeric"
	"github.com/m3db/prometheus_remote_client_golang/promremote"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

const backendType = "prometheus"

const (
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
)

var (
	// Unexpected, 500-like write errors.
	ErrUnexpectedWriteFailure = errors.New("failed to write time series")
	// Expected, user-level write errors like trying to write an invalid series.
	ErrRejectedWrite = errors.New("series was rejected")
	ErrBadFrame      = errors.New("failed to read dataframe")

	// IgnoredErrors don't cause the Write to fail, but are still logged.
	IgnoredErrors = []string{
		MimirSampleDuplicateTimestampError,
		PrometheusDuplicateTimestampError,
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
	client  promremote.Client
	clock   clock.Clock
	logger  log.Logger
	metrics *metrics.RemoteWriter
}

type PrometheusWriterConfig struct {
	URL         string
	HTTPOptions httpclient.Options
	Timeout     time.Duration
}

func NewPrometheusWriterWithSettings(
	settings setting.RecordingRuleSettings,
	httpClientProvider HttpClientProvider,
	clock clock.Clock,
	l log.Logger,
	metrics *metrics.RemoteWriter,
) (*PrometheusWriter, error) {
	if err := validateSettings(settings); err != nil {
		return nil, err
	}

	headers := make(http.Header)
	for k, v := range settings.CustomHeaders {
		headers.Add(k, v)
	}

	cfg := PrometheusWriterConfig{
		URL: settings.URL,
		HTTPOptions: httpclient.Options{
			BasicAuth: createAuthOpts(settings.BasicAuthUsername, settings.BasicAuthPassword),
			Header:    headers,
		},
		Timeout: settings.Timeout,
	}

	return NewPrometheusWriter(cfg, httpClientProvider, clock, l, metrics)
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

	return &PrometheusWriter{
		client:  client,
		clock:   clock,
		logger:  l,
		metrics: metrics,
	}, nil
}

func validateSettings(settings setting.RecordingRuleSettings) error {
	if settings.BasicAuthUsername != "" && settings.BasicAuthPassword == "" {
		return fmt.Errorf("basic auth password is required if username is set")
	}

	if _, err := url.Parse(settings.URL); err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}

	if settings.Timeout <= 0 {
		return fmt.Errorf("timeout must be greater than 0")
	}

	return nil
}

func createAuthOpts(username, password string) *httpclient.BasicAuthOptions {
	// If username is empty, do not use basic auth and ignore password.
	if username == "" {
		return nil
	}

	return &httpclient.BasicAuthOptions{
		User:     username,
		Password: password,
	}
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
	lvs := []string{fmt.Sprint(orgID), backendType}

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

func checkWriteError(writeErr promremote.WriteError) (err error, ignored bool) {
	if writeErr == nil {
		return nil, false
	}

	// All 500-range statuses are automatically unexpected and not the fault of the data.
	if writeErr.StatusCode()/100 == 5 {
		return errors.Join(ErrUnexpectedWriteFailure, writeErr), false
	}

	// Special case for 400 status code. 400s may be ignorable in the event of HA writers, or the fault of the written data.
	if writeErr.StatusCode() == 400 {
		msg := writeErr.Error()
		// HA may potentially write different values for the same timestamp, so we ignore this error
		// TODO: this may not be needed, further testing needed
		for _, e := range IgnoredErrors {
			if strings.Contains(msg, e) {
				return nil, true
			}
		}

		// Check for expected user errors.
		for _, e := range ExpectedErrors {
			if strings.Contains(msg, e) {
				return errors.Join(ErrRejectedWrite, writeErr), false
			}
		}

		// For now, all 400s that are not previously known are considered unexpected.
		// TODO: Consider blanket-converting all 400s to be known errors. This should only be done once we are confident this is not a problem with this client.
		return errors.Join(ErrUnexpectedWriteFailure, writeErr), false
	}

	// All other errors which do not fit into the above categories are also unexpected.
	return errors.Join(ErrUnexpectedWriteFailure, writeErr), false
}
