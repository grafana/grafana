package notification

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/alerting/notify/historian"
	"github.com/grafana/alerting/notify/historian/lokiclient"
	"github.com/grafana/dskit/instrument"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/apps/alerting/historian/pkg/apis/alertinghistorian/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/historian/pkg/app/logutil"
)

const (
	LokiClientSpanName = "grafana.apps.alerting.historian.client"
	defaultQueryRange  = 6 * time.Hour
	defaultLimit       = 1000
	Namespace          = "grafana"
	Subsystem          = "alerting"
)

type lokiClient interface {
	Ping(context.Context) error
	RangeQuery(ctx context.Context, logQL string, start, end, limit int64) (lokiclient.QueryRes, error)
}

type LokiReader struct {
	client lokiClient
	logger logging.Logger

	duration *instrument.HistogramCollector
}

func NewLokiReader(cfg lokiclient.LokiConfig, reg prometheus.Registerer, logger logging.Logger, tracer trace.Tracer) *LokiReader {
	duration := instrument.NewHistogramCollector(promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
		Namespace: Namespace,
		Subsystem: Subsystem,
		Name:      "notification_history_read_request_duration_seconds",
		Help:      "Histogram of read request durations to the notification history store.",
		Buckets:   instrument.DefBuckets,
	}, instrument.HistogramCollectorBuckets))

	gkLogger := logutil.ToGoKitLogger(logger)
	return &LokiReader{
		client: lokiclient.NewLokiClient(cfg, lokiclient.NewRequester(), nil, duration, gkLogger, tracer, LokiClientSpanName),
		logger: logger,
	}
}

func (h *LokiReader) TestConnection(ctx context.Context) error {
	return h.client.Ping(ctx)
}

// Query retrieves notification history entries from an external Loki instance.
func (h *LokiReader) Query(ctx context.Context, query Query) (QueryResult, error) {
	logql := buildQuery(query)

	now := time.Now().UTC()

	from := now.Add(-defaultQueryRange).UnixNano()
	if query.From != nil {
		from = *query.From
	}

	to := now.UnixNano()
	if query.To != nil {
		to = *query.To
	}

	limit := int64(defaultLimit)
	if query.Limit != nil {
		limit = *query.Limit
	}

	// Timestamps are expected in RFC3339Nano.
	r, err := h.client.RangeQuery(ctx, logql, from, to, limit)
	if err != nil {
		return QueryResult{}, fmt.Errorf("loki range query: %w", err)
	}

	entries := make([]Entry, 0)
	for _, stream := range r.Data.Result {
		for _, s := range stream.Values {
			entry, err := parseLokiEntry(s)
			if err != nil {
				h.logger.Warn("ignoring notification entry", "err", err)
				continue
			}
			entries = append(entries, entry)
		}
	}

	return QueryResult{
		Entries: entries,
	}, nil
}

// buildQuery creates the LogQL to perform the requested query.
// TODO: Decide the RBAC filtering model
func buildQuery(query Query) string {
	// TODO: The current format of notification history is broken for looking up by rule UID,
	// because it just uses the UID of the first alert in the notification. This needs to be
	// changed to store all the UIDs in a single label.

	selectors := []string{
		fmt.Sprintf(`%s=%q`, historian.LabelFrom, historian.LabelFromValue),
	}

	if query.RuleUID != nil {
		selectors = append(selectors,
			fmt.Sprintf(`%s=%q`, historian.LabelRuleUID, *query.RuleUID))
	}

	logql := fmt.Sprintf(`{%s} | json`, strings.Join(selectors, `,`))

	// Add receiver filter if specified.
	if query.Receiver != nil && *query.Receiver != "" {
		logql += fmt.Sprintf(` | receiver = %q`, *query.Receiver)
	}

	// Add status filter if specified.
	if query.Status != nil && *query.Status != "" {
		logql += fmt.Sprintf(` | status = %q`, *query.Status)
	}

	// Add outcome filter if specified.
	if query.Outcome != nil && *query.Outcome != "" {
		switch *query.Outcome {
		case v0alpha1.CreateNotificationqueryRequestNotificationOutcomeSuccess:
			logql += ` | error = ""`
		case v0alpha1.CreateNotificationqueryRequestNotificationOutcomeError:
			logql += ` | error != ""`
		}
	}

	return logql
}

func parseLokiEntry(s lokiclient.Sample) (Entry, error) {
	var lokiEntry historian.NotificationHistoryLokiEntry
	err := json.Unmarshal([]byte(s.V), &lokiEntry)
	if err != nil {
		return Entry{}, fmt.Errorf("failed to unmarshal entry: %w", "err", err)
	}

	if lokiEntry.SchemaVersion != 1 {
		return Entry{}, fmt.Errorf("unsupported schema version: %d", lokiEntry.SchemaVersion)
	}

	outcome := OutcomeSuccess
	var entryError *string
	if lokiEntry.Error != "" {
		outcome = OutcomeError
		entryError = &lokiEntry.Error
	}

	groupLabels := lokiEntry.GroupLabels
	if groupLabels == nil {
		groupLabels = make(map[string]string)
	}

	alerts := make([]EntryAlert, len(lokiEntry.Alerts))
	for i, a := range lokiEntry.Alerts {
		alerts[i] = EntryAlert{
			Status:      a.Status,
			Labels:      a.Labels,
			Annotations: a.Annotations,
			StartsAt:    a.StartsAt.UnixNano(),
			EndsAt:      a.EndsAt.UnixNano(),
		}
	}

	return Entry{
		Timestamp:    s.T.UnixNano(),
		Receiver:     lokiEntry.Receiver,
		Status:       Status(lokiEntry.Status),
		Outcome:      outcome,
		GroupLabels:  groupLabels,
		Alerts:       alerts,
		Retry:        lokiEntry.Retry,
		Error:        entryError,
		Duration:     lokiEntry.Duration,
		PipelineTime: lokiEntry.PipelineTime.UnixNano(),
	}, nil
}
