package notification

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strconv"
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
	"github.com/grafana/grafana/apps/alerting/historian/pkg/app/config"
	"github.com/grafana/grafana/apps/alerting/historian/pkg/app/logutil"
)

const (
	LokiClientSpanName = "grafana.apps.alerting.historian.client"
	defaultQueryRange  = 6 * time.Hour
	defaultLimit       = 100
	maxLimit           = 1000
	Namespace          = "grafana"
	Subsystem          = "alerting"
)

var (
	// ErrInvalidQuery is returned if the query is invalid.
	ErrInvalidQuery = errors.New("invalid query")

	validLabelKeyRegex = regexp.MustCompile("^[a-zA-Z_][a-zA-Z0-9_]*$")
	validRuleUIDRegex  = regexp.MustCompile(`^[a-zA-Z0-9\-\_]*$`)
)

type lokiClient interface {
	RangeQuery(ctx context.Context, logQL string, start, end, limit int64) (lokiclient.QueryRes, error)
	MetricsQuery(ctx context.Context, logQL string, ts int64, limit int64) (lokiclient.MetricsQueryRes, error)
}

type LokiReader struct {
	client lokiClient
	logger logging.Logger
}

func NewLokiReader(cfg config.LokiConfig, reg prometheus.Registerer, logger logging.Logger, tracer trace.Tracer) *LokiReader {
	duration := instrument.NewHistogramCollector(promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
		Namespace: Namespace,
		Subsystem: Subsystem,
		Name:      "notification_history_read_request_duration_seconds",
		Help:      "Histogram of read request durations to the notification history store.",
		Buckets:   instrument.DefBuckets,
	}, instrument.HistogramCollectorBuckets))

	requester := &http.Client{
		Transport: cfg.Transport,
	}

	gkLogger := logutil.ToGoKitLogger(logger)
	return &LokiReader{
		client: lokiclient.NewLokiClient(cfg.LokiConfig, requester, nil, duration, gkLogger, tracer, LokiClientSpanName),
		logger: logger,
	}
}

// Query retrieves notification history from an external Loki instance.
// When query.Type is "counts", it returns aggregated counts via a metrics query.
// Otherwise it returns individual notification entries via a range query.
func (h *LokiReader) Query(ctx context.Context, query Query) (QueryResult, error) {
	logql, err := buildQuery(query)
	if err != nil {
		return QueryResult{}, err
	}

	now := time.Now().UTC()
	from := now.Add(-defaultQueryRange)
	if query.From != nil {
		from = *query.From
	}
	to := now
	if query.To != nil {
		to = *query.To
	}

	limit := int64(defaultLimit)
	if query.Limit != nil {
		limit = *query.Limit
	}

	if limit > maxLimit {
		return QueryResult{}, fmt.Errorf("%w: limit (%d) over maximum allowed (%d)", ErrInvalidQuery, limit, maxLimit)
	}

	qtype := v0alpha1.CreateNotificationqueryRequestBodyTypeEntries
	if query.Type != nil {
		qtype = *query.Type
	}

	switch qtype {
	case v0alpha1.CreateNotificationqueryRequestBodyTypeEntries:
		entries, err := h.runQuery(ctx, logql, from, to, limit)
		if err != nil {
			return QueryResult{}, err
		}

		return QueryResult{Entries: entries}, nil

	case v0alpha1.CreateNotificationqueryRequestBodyTypeCounts:
		// Default to no grouping (all false).
		groupBy := QueryGroupBy{}
		if query.GroupBy != nil {
			groupBy = *query.GroupBy
		}
		counts, err := h.runMetricsQuery(ctx, logql, from, to, limit, groupBy)
		if err != nil {
			return QueryResult{}, err
		}

		return QueryResult{Counts: counts}, nil

	default:
		return QueryResult{}, fmt.Errorf("%w: unknown query type (%s)", ErrInvalidQuery, string(qtype))
	}
}

// QueryAlerts retrieves individual alert entries from an external Loki instance.
func (h *LokiReader) QueryAlerts(ctx context.Context, query AlertQuery) (AlertQueryResult, error) {
	logql, err := buildAlertQuery(query)
	if err != nil {
		return AlertQueryResult{}, err
	}

	now := time.Now().UTC()
	from := now.Add(-defaultQueryRange)
	if query.From != nil {
		from = *query.From
	}
	to := now
	if query.To != nil {
		to = *query.To
	}

	limit := int64(defaultLimit)
	if query.Limit != nil {
		limit = *query.Limit
	}

	if limit > maxLimit {
		return AlertQueryResult{}, fmt.Errorf("%w: limit (%d) over maximum allowed (%d)", ErrInvalidQuery, limit, maxLimit)
	}

	alerts, err := h.runAlertQuery(ctx, logql, from, to, limit)
	if err != nil {
		return AlertQueryResult{}, err
	}

	// Prune alerts to the requested limit.
	if int64(len(alerts)) > limit {
		alerts = alerts[:limit]
	}

	return AlertQueryResult{
		Alerts: alerts,
	}, nil
}

// buildMetricsQuery constructs the LogQL metrics query that wraps a log filter in a
// topk(sum(count_over_time(...))) aggregation.
func buildMetricsQuery(logqlInner string, from, to time.Time, limit int64, groupBy QueryGroupBy) string {
	// Additional expressions for the inner query if needed.
	logqlInnerExtra := ""

	// If grouping by outcome, create a field based on whether error is empty.
	if groupBy.Outcome {
		logqlInnerExtra += ` | label_format outcome="{{ if .error }}error{{ else }}success{{ end }}"`
	}

	// Optionally add the grouping, if any.
	var labels []string
	if groupBy.Receiver {
		labels = append(labels, "receiver")
	}
	if groupBy.Integration {
		labels = append(labels, "integration")
	}
	if groupBy.IntegrationIndex {
		labels = append(labels, "integrationIdx")
	}
	if groupBy.Status {
		labels = append(labels, "status")
	}
	if groupBy.Outcome {
		labels = append(labels, "outcome")
	}
	if groupBy.Error {
		labels = append(labels, "error")
	}
	sumBy := ""
	if len(labels) > 0 {
		sumBy = fmt.Sprintf(" by (%s) ", strings.Join(labels, ","))
	}

	rangeSeconds := int64(to.Sub(from).Seconds())
	return fmt.Sprintf(`topk(%d, sum%s(count_over_time(%s%s[%ds])))`,
		limit, sumBy, logqlInner, logqlInnerExtra, rangeSeconds)
}

// runMetricsQuery executes a sum(count_over_time(...)) instant query against Loki and
// converts the metric samples into Count values.
func (h *LokiReader) runMetricsQuery(ctx context.Context, logqlInner string, from, to time.Time, limit int64, groupBy QueryGroupBy) ([]Count, error) {
	logql := buildMetricsQuery(logqlInner, from, to, limit, groupBy)

	res, err := h.client.MetricsQuery(ctx, logql, to.UnixNano(), limit)
	if err != nil {
		return nil, fmt.Errorf("loki metrics query: %w", err)
	}

	counts := make([]Count, 0, len(res.Data.Result))
	for _, sample := range res.Data.Result {
		count, err := parseCount(sample)
		if err != nil {
			h.logger.Warn("Ignoring metric sample", "err", err)
			continue
		}
		counts = append(counts, count)
	}

	// Sort counts by count (highest first).
	sort.Slice(counts, func(i, j int) bool {
		return counts[i].Count > counts[j].Count
	})

	return counts, nil
}

// parseCount converts a single Loki MetricSample into a Count.
func parseCount(sample lokiclient.MetricSample) (Count, error) {
	countStr, err := sample.Value.Value()
	if err != nil {
		return Count{}, fmt.Errorf("unparseable value: %w", err)
	}
	count, err := strconv.ParseInt(countStr, 10, 64)
	if err != nil {
		return Count{}, fmt.Errorf("non-integer count %q: %w", countStr, err)
	}

	entry := Count{Count: count}
	m := sample.Metric
	if v, ok := m["receiver"]; ok {
		entry.Receiver = &v
	}
	if v, ok := m["integration"]; ok {
		entry.Integration = &v
	}
	if v, ok := m["integrationIdx"]; ok {
		i, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return Count{}, fmt.Errorf("non-integer integrationIdx %q: %w", v, err)
		}
		entry.IntegrationIndex = &i
	}
	if v, ok := m["status"]; ok {
		s := Status(v)
		entry.Status = &s
	}
	if v, ok := m["outcome"]; ok {
		o := Outcome(v)
		entry.Outcome = &o
	}
	if v, ok := m["error"]; ok {
		entry.Error = &v
	}
	return entry, nil
}

// buildAlertQuery creates the LogQL to perform the requested alert query.
func buildAlertQuery(query AlertQuery) (string, error) {
	selectors := []string{
		fmt.Sprintf(`%s=%q`, historian.LabelFrom, historian.LabelFromValueAlerts),
	}

	logql := fmt.Sprintf(`{%s}`, strings.Join(selectors, `,`))

	// UUID filtering uses structured metadata.
	if query.Uuid != nil && *query.Uuid != "" {
		logql += fmt.Sprintf(` | uuid = %q`, *query.Uuid)
	}

	logql += ` | json`

	return logql, nil
}

// runAlertQuery runs the query and collects alert results.
func (l *LokiReader) runAlertQuery(ctx context.Context, logql string, from, to time.Time, limit int64) ([]AlertEntry, error) {
	alerts := make([]AlertEntry, 0)
	r, err := l.client.RangeQuery(ctx, logql, from.UnixNano(), to.UnixNano(), limit)
	if err != nil {
		return nil, fmt.Errorf("loki range query: %w", err)
	}

	for _, stream := range r.Data.Result {
		for _, s := range stream.Values {
			alert, err := parseLokiAlertEntry(s)
			if err != nil {
				l.logger.Warn("Ignoring alert history entry", "err", err)
				continue
			}
			alerts = append(alerts, alert)
		}
	}

	// Sort entries by timestamp (descending - newest first).
	sort.Slice(alerts, func(i, j int) bool {
		return alerts[i].StartsAt.After(alerts[j].StartsAt)
	})

	l.logger.Debug("Alert history query complete", "alerts", len(alerts))

	return alerts, nil
}

// parseLokiAlertEntry unmarshals the JSON stored in an alert entry.
func parseLokiAlertEntry(s lokiclient.Sample) (AlertEntry, error) {
	var lokiEntry historian.NotificationHistoryLokiEntryAlert
	err := json.Unmarshal([]byte(s.V), &lokiEntry)
	if err != nil {
		return AlertEntry{}, fmt.Errorf("failed to unmarshal alert entry [%s]: %w", s.T, err)
	}

	if lokiEntry.SchemaVersion != historian.SchemaVersion {
		return AlertEntry{}, fmt.Errorf("unsupported schema version [%s]: %d", s.T, lokiEntry.SchemaVersion)
	}

	labels := lokiEntry.Labels
	if labels == nil {
		labels = make(map[string]string)
	}

	annotations := lokiEntry.Annotations
	if annotations == nil {
		annotations = make(map[string]string)
	}

	return AlertEntry{
		Status:      lokiEntry.Status,
		Labels:      labels,
		Annotations: annotations,
		StartsAt:    lokiEntry.StartsAt,
		EndsAt:      lokiEntry.EndsAt,
		Enrichments: lokiEntry.ExtraData,
	}, nil
}

// buildQuery creates the LogQL to perform the requested query.
func buildQuery(query Query) (string, error) {
	selectors := []string{
		fmt.Sprintf(`%s=%q`, historian.LabelFrom, historian.LabelFromValue),
	}

	logql := fmt.Sprintf(`{%s}`, strings.Join(selectors, `,`))

	// RuleUID filtering can be performed using the comma separated structured metadata fields.
	// We can match the uid exactly by anchoring the match to a comma or start/end.
	if query.RuleUID != nil && *query.RuleUID != "" {
		// Validate the uid close to where it is used to form the query,
		// to reduce the risk of introducing a query injection bug.
		if !validRuleUIDRegex.MatchString(*query.RuleUID) {
			return "", fmt.Errorf("%w: rule uid: %q", ErrInvalidQuery, *query.RuleUID)
		}
		logql += fmt.Sprintf(` | rule_uids =~ "(^|.*,)%s($|,.*)"`, *query.RuleUID)
	}

	// Receiver filtering can be done entirely using structured metadata fields.
	if query.Receiver != nil && *query.Receiver != "" {
		logql += fmt.Sprintf(` | receiver = %q`, *query.Receiver)
	}

	logql += ` | json`

	// Add status filter if specified.
	if query.Status != nil && *query.Status != "" {
		logql += fmt.Sprintf(` | status = %q`, *query.Status)
	}

	// Add group labels filter if specified.
	if query.GroupLabels != nil {
		for _, matcher := range *query.GroupLabels {
			// Validate the matcher close to where it is used to form the query,
			// to reduce the risk of introducing a query injection bug.
			if !validLabelKeyRegex.MatchString(matcher.Label) {
				return "", fmt.Errorf("%w: group label: %q", ErrInvalidQuery, matcher.Label)
			}
			switch matcher.Type {
			case "=", "!=", "=~", "!~":
			default:
				return "", fmt.Errorf("%w: matcher type: %s", ErrInvalidQuery, matcher.Type)
			}
			logql += fmt.Sprintf(` | groupLabels_%s %s %q`, matcher.Label, matcher.Type, matcher.Value)
		}
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

	return logql, nil
}

// runQuery runs the query and collects results, grouping alerts into notifications.
func (l *LokiReader) runQuery(ctx context.Context, logql string, from, to time.Time, limit int64) ([]Entry, error) {
	entries := make([]Entry, 0)
	r, err := l.client.RangeQuery(ctx, logql, from.UnixNano(), to.UnixNano(), limit)
	if err != nil {
		return nil, fmt.Errorf("loki range query: %w", err)
	}

	for _, stream := range r.Data.Result {
		for _, s := range stream.Values {
			entry, err := parseLokiEntry(s)
			if err != nil {
				l.logger.Warn("Ignoring notification history entry", "err", err)
				continue
			}
			entries = append(entries, entry)
		}
	}

	// Sort entries by timestamp (descending - newest first)
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Timestamp.After(entries[j].Timestamp)
	})

	l.logger.Debug("Notification history query complete", "notifications", len(entries))

	return entries, nil
}

// parseLokiEntry unmarshals the JSON stored in the entry.
func parseLokiEntry(s lokiclient.Sample) (Entry, error) {
	var lokiEntry historian.NotificationHistoryLokiEntry
	err := json.Unmarshal([]byte(s.V), &lokiEntry)
	if err != nil {
		return Entry{}, fmt.Errorf("failed to unmarshal entry [%s]: %w", s.T, err)
	}

	if lokiEntry.SchemaVersion != 2 {
		return Entry{}, fmt.Errorf("unsupported schema version [%s]: %d", s.T, lokiEntry.SchemaVersion)
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

	ruleUIDs := lokiEntry.RuleUIDs
	if ruleUIDs == nil {
		ruleUIDs = []string{}
	}

	return Entry{
		Timestamp:        s.T,
		Uuid:             lokiEntry.UUID,
		Receiver:         lokiEntry.Receiver,
		Integration:      lokiEntry.Integration,
		IntegrationIndex: int64(lokiEntry.IntegrationIdx),
		Status:           Status(lokiEntry.Status),
		Outcome:          outcome,
		GroupKey:         lokiEntry.GroupKey,
		GroupLabels:      groupLabels,
		RuleUIDs:         ruleUIDs,
		AlertCount:       int64(lokiEntry.AlertCount),
		Alerts:           []EntryAlert{},
		Retry:            lokiEntry.Retry,
		Error:            entryError,
		Duration:         lokiEntry.Duration,
		PipelineTime:     lokiEntry.PipelineTime,
	}, nil
}
