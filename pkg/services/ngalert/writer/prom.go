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
	// Fixed error messages
	MimirDuplicateTimestampError     = "err-mimir-sample-duplicate-timestamp"
	MimirInvalidLabelError           = "err-mimir-label-invalid"
	MimirLabelValueTooLongError      = "err-mimir-label-value-too-long"
	MimirMaxLabelNamesPerSeriesError = "err-mimir-max-label-names-per-series"
	MimirMaxSeriesPerUserError       = "err-mimir-max-series-per-user"

	// Best effort error messages
	PrometheusDuplicateTimestampError = "duplicate sample for timestamp"
)

var (
	// Unexpected, 500-like write errors.
	ErrUnexpectedWriteFailure = errors.New("failed to write time series")
	// Expected, user-level write errors like trying to write an invalid series.
	ErrRejectedWrite = errors.New("series was rejected")
	ErrBadFrame      = errors.New("failed to read dataframe")
)

var DuplicateTimestampErrors = [...]string{
	MimirDuplicateTimestampError,
	PrometheusDuplicateTimestampError,
}

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

func NewPrometheusWriter(
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

	cl, err := httpClientProvider.New(httpclient.Options{
		BasicAuth: createAuthOpts(settings.BasicAuthUsername, settings.BasicAuthPassword),
		Header:    headers,
	})
	if err != nil {
		return nil, err
	}

	clientCfg := promremote.NewConfig(
		promremote.UserAgent("grafana-recording-rule"),
		promremote.WriteURLOption(settings.URL),
		promremote.HTTPClientTimeoutOption(settings.Timeout),
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
		for _, e := range DuplicateTimestampErrors {
			if strings.Contains(msg, e) {
				return nil, true
			}
		}

		// Check for expected user errors.
		switch {
		case strings.Contains(msg, MimirInvalidLabelError),
			strings.Contains(msg, MimirMaxSeriesPerUserError),
			strings.Contains(msg, MimirMaxLabelNamesPerSeriesError),
			strings.Contains(msg, MimirLabelValueTooLongError):
			return errors.Join(ErrRejectedWrite, writeErr), false
		}

		// For now, all 400s that are not previously known are considered unexpected.
		// TODO: Consider blanket-converting all 400s to be known errors. This should only be done once we are confident this is not a problem with this client.
		return errors.Join(ErrUnexpectedWriteFailure, writeErr), false
	}

	// All other errors which do not fit into the above categories are also unexpected.
	return errors.Join(ErrUnexpectedWriteFailure, writeErr), false
}
