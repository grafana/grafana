package notification

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"sort"
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

	// LogQL field path for alert rule UID after JSON parsing.
	// Loki flattens nested JSON fields with underscores: alert.labels.__alert_rule_uid__ -> alert_labels___alert_rule_uid__
	lokiAlertRuleUIDField = "alert_labels___alert_rule_uid__"
)

var (
	// ErrInvalidQuery is returned if the query is invalid.
	ErrInvalidQuery = errors.New("invalid query")

	validLabelKeyRegex = regexp.MustCompile("^[a-zA-Z_][a-zA-Z0-9_]*$")
)

type lokiClient interface {
	RangeQuery(ctx context.Context, logQL string, start, end, limit int64) (lokiclient.QueryRes, error)
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

// Query retrieves notification history entries from an external Loki instance.
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

	entries, err := h.runQuery(ctx, logql, from, to, limit)
	if err != nil {
		return QueryResult{}, err
	}

	// Prune entries to the requested limit
	if int64(len(entries)) > limit {
		entries = entries[:limit]
	}

	return QueryResult{
		Entries: entries,
	}, nil
}

// buildQuery creates the LogQL to perform the requested query.
func buildQuery(query Query) (string, error) {
	selectors := []string{
		fmt.Sprintf(`%s=%q`, historian.LabelFrom, historian.LabelFromValue),
	}

	logql := fmt.Sprintf(`{%s}`, strings.Join(selectors, `,`))

	// Searching for ruleUID before JSON parsing can dramatically improve performance.
	if query.RuleUID != nil && *query.RuleUID != "" {
		logql += fmt.Sprintf(` |= %q`, *query.RuleUID)
	}

	logql += ` | json`

	// Add ruleUID filter as JSON line filter if specified.
	if query.RuleUID != nil && *query.RuleUID != "" {
		logql += fmt.Sprintf(` | %s = %q`, lokiAlertRuleUIDField, *query.RuleUID)
	}

	// Add receiver filter if specified.
	if query.Receiver != nil && *query.Receiver != "" {
		logql += fmt.Sprintf(` | receiver = %q`, *query.Receiver)
	}

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

	// Add alert labels filter if specified.
	if query.Labels != nil {
		for _, matcher := range *query.Labels {
			// Validate the matcher close to where it is used to form the query,
			// to reduce the risk of introducing a query injection bug.
			if !validLabelKeyRegex.MatchString(matcher.Label) {
				return "", fmt.Errorf("%w: alert label: %q", ErrInvalidQuery, matcher.Label)
			}
			switch matcher.Type {
			case "=", "!=", "=~", "!~":
			default:
				return "", fmt.Errorf("%w: matcher type: %s", ErrInvalidQuery, matcher.Type)
			}
			logql += fmt.Sprintf(` | alert_labels_%s %s %q`, matcher.Label, matcher.Type, matcher.Value)
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
	// Note that we ask Loki for the configured maximum lines (usually 5000).
	// This means that if some notifications have lots of alerts, then we may not
	// return enough entries.
	entries := make([]Entry, 0)
	r, err := l.client.RangeQuery(ctx, logql, from.UnixNano(), to.UnixNano(), 5000)
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

	// Group individual alerts into notifications
	entries = groupEntries(entries)

	// Sort entries by timestamp (descending - newest first)
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Timestamp.After(entries[j].Timestamp)
	})

	l.logger.Debug("Notification history query complete", "notifications", len(entries))

	return entries, nil
}

// groupAlerts combines alerts that belong to the same notification.
// Alerts are grouped together if they have the same groupKey and pipelineTime.
func groupEntries(entries []Entry) []Entry {
	type key struct {
		groupKey     string
		pipelineTime int64
	}
	groups := make(map[key][]Entry)
	var orderedKeys []key

	for _, entry := range entries {
		k := key{
			groupKey:     entry.GroupKey,
			pipelineTime: entry.PipelineTime.UnixNano(),
		}
		if _, exists := groups[k]; !exists {
			orderedKeys = append(orderedKeys, k)
		}
		groups[k] = append(groups[k], entry)
	}

	result := make([]Entry, 0, len(groups))
	for _, k := range orderedKeys {
		groupEntries := groups[k]
		entry := groupEntries[0]
		for _, otherEntry := range groupEntries[1:] {
			entry.Alerts = append(entry.Alerts, otherEntry.Alerts...)
		}
		result = append(result, entry)
	}

	return result
}

// parseLokiEntry unmarshals the JSON stored in the entry.
func parseLokiEntry(s lokiclient.Sample) (Entry, error) {
	var lokiEntry historian.NotificationHistoryLokiEntry
	err := json.Unmarshal([]byte(s.V), &lokiEntry)
	if err != nil {
		return Entry{}, fmt.Errorf("failed to unmarshal entry [%s]: %w", s.T, err)
	}

	if lokiEntry.SchemaVersion != 1 {
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

	alerts := []EntryAlert{{
		Status:      lokiEntry.Alert.Status,
		Labels:      lokiEntry.Alert.Labels,
		Annotations: lokiEntry.Alert.Annotations,
		StartsAt:    lokiEntry.Alert.StartsAt,
		EndsAt:      lokiEntry.Alert.EndsAt,
	}}

	return Entry{
		Timestamp:    s.T,
		Receiver:     lokiEntry.Receiver,
		Status:       Status(lokiEntry.Status),
		Outcome:      outcome,
		GroupKey:     lokiEntry.GroupKey,
		GroupLabels:  groupLabels,
		Alerts:       alerts,
		Retry:        lokiEntry.Retry,
		Error:        entryError,
		Duration:     lokiEntry.Duration,
		PipelineTime: lokiEntry.PipelineTime,
	}, nil
}
