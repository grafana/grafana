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
	MetricsRangeQuery(ctx context.Context, logQL string, start, end, limit, step int64) (lokiclient.MetricsRangeQueryRes, error)
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
//
// When query.Labels is set, a two-phase cross-stream lookup is performed:
// first the alerts stream is queried for matching labels to collect UUIDs,
// then the notifications stream is filtered by those UUIDs.
func (h *LokiReader) Query(ctx context.Context, query Query) (QueryResult, error) {
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

	// Phase 1: If labels are specified, query the alerts stream to collect matching UUIDs.
	var labelUUIDs []string
	if query.Labels != nil && len(*query.Labels) > 0 {
		alertLogql, err := buildAlertLabelQuery(query.RuleUID, *query.Labels)
		if err != nil {
			return QueryResult{}, err
		}
		labelUUIDs, err = h.runAlertUUIDQuery(ctx, alertLogql, from, to)
		if err != nil {
			return QueryResult{}, err
		}
		if len(labelUUIDs) == 0 {
			// No alerts match the label filter — return empty result.
			return QueryResult{Entries: []Entry{}, Counts: []Count{}}, nil
		}
	}

	// Phase 2: Build and run the notifications query, optionally filtered by UUIDs.
	logql, err := buildQuery(query, labelUUIDs)
	if err != nil {
		return QueryResult{}, err
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

	case v0alpha1.CreateNotificationqueryRequestBodyTypeRangeCounts:
		// Default to no grouping (all false).
		groupBy := QueryGroupBy{}
		if query.GroupBy != nil {
			groupBy = *query.GroupBy
		}
		step := defaultStep(from, to)
		if query.Step != nil && *query.Step > 0 {
			step = time.Duration(*query.Step) * time.Second
		}
		rangeCounts, err := h.runMetricsRangeQuery(ctx, logql, from, to, limit, step, groupBy)
		if err != nil {
			return QueryResult{}, err
		}

		return QueryResult{Counts: rangeCounts}, nil

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
	inner := buildMetricsRangeQuery(logqlInner, to.Sub(from), groupBy)
	// Skip topk when grouping by RuleUID because the raw rule_uids label contains
	// comma-separated UIDs that must be exploded client-side before applying topk.
	if groupBy.RuleUID {
		return inner
	}
	return fmt.Sprintf(`topk(%d, %s)`, limit, inner)
}

// buildMetricsRangeQuery constructs a LogQL sum(count_over_time(...)) expression
// with the given step as the range selector.
func buildMetricsRangeQuery(logqlInner string, step time.Duration, groupBy QueryGroupBy) string {
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
	if groupBy.RuleUID {
		labels = append(labels, "rule_uids")
		labels = append(labels, "groupLabels_alertname")
	}
	sumBy := ""
	if len(labels) > 0 {
		sumBy = fmt.Sprintf(" by (%s) ", strings.Join(labels, ","))
	}

	stepSeconds := int64(step.Seconds())
	return fmt.Sprintf(`sum%s(count_over_time(%s%s[%ds]))`,
		sumBy, logqlInner, logqlInnerExtra, stepSeconds)
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

	// When grouping by RuleUID, explode the comma-separated rule_uids into
	// individual counts, aggregate, and apply client-side topk.
	if groupBy.RuleUID {
		counts = explodeRuleUIDCounts(counts, limit)
	}

	// Sort counts by count (highest first).
	sort.Slice(counts, func(i, j int) bool {
		return counts[i].Count > counts[j].Count
	})

	return counts, nil
}

// explodeRuleUIDCounts splits counts with comma-separated rule_uids into individual
// counts per rule UID, aggregates (sums) counts sharing the same (ruleUID + other groupBy
// dimensions) key, sorts by count descending, and applies the limit (client-side topk).
func explodeRuleUIDCounts(counts []Count, limit int64) []Count {
	aggregated := make(map[string]*Count)

	key := func(c Count) string {
		c0 := c
		c0.Count = 0
		b, _ := json.Marshal(c0)
		return string(b)
	}

	for _, c := range counts {
		ruleUIDs := []string{""}
		if c.RuleUID != nil && *c.RuleUID != "" {
			ruleUIDs = strings.Split(*c.RuleUID, ",")
		}
		for _, uid := range ruleUIDs {
			entry := c
			uidCopy := uid
			entry.RuleUID = &uidCopy
			k := key(entry)
			if existing, ok := aggregated[k]; ok {
				existing.Count += entry.Count
			} else {
				aggregated[k] = &entry
			}
		}
	}

	result := make([]Count, 0, len(aggregated))
	for _, c := range aggregated {
		result = append(result, *c)
	}

	// Sort by count descending.
	sort.Slice(result, func(i, j int) bool {
		return result[i].Count > result[j].Count
	})

	// Apply limit (client-side topk).
	if int64(len(result)) > limit {
		result = result[:limit]
	}

	return result
}

// defaultStep returns a sensible default step interval for a range query over the given time range.
// It targets roughly 100 data points across the range.
func defaultStep(from, to time.Time) time.Duration {
	d := to.Sub(from) / 100
	if d < time.Minute {
		d = time.Minute
	}
	return d
}

// runMetricsRangeQuery executes a sum(count_over_time(...)) range query against Loki and
// converts the metric matrix results into RangeCount values.
func (h *LokiReader) runMetricsRangeQuery(ctx context.Context, logqlInner string, from, to time.Time, limit int64, step time.Duration, groupBy QueryGroupBy) ([]Count, error) {
	logql := buildMetricsRangeQuery(logqlInner, step, groupBy)

	res, err := h.client.MetricsRangeQuery(ctx, logql, from.UnixNano(), to.UnixNano(), limit, int64(step.Seconds()))
	if err != nil {
		return nil, fmt.Errorf("loki metrics range query: %w", err)
	}

	rangeCounts := make([]Count, 0, len(res.Data.Result))
	for _, sample := range res.Data.Result {
		rangeCount, err := parseRangeCount(sample)
		if err != nil {
			h.logger.Warn("Ignoring metric range sample", "err", err)
			continue
		}
		rangeCounts = append(rangeCounts, rangeCount)
	}

	return rangeCounts, nil
}

// parseRangeCount converts a single Loki MetricRangeSample into a Count.
func parseRangeCount(sample lokiclient.MetricRangeSample) (Count, error) {
	entry, err := parseCountLabels(sample.Metric)
	if err != nil {
		return Count{}, err
	}

	entry.Values = make([]RangeValue, 0, len(sample.Values))
	for _, sv := range sample.Values {
		ts, err := sv.Timestamp()
		if err != nil {
			return Count{}, fmt.Errorf("unparseable timestamp: %w", err)
		}
		countStr, err := sv.Value()
		if err != nil {
			return Count{}, fmt.Errorf("unparseable value: %w", err)
		}
		count, err := strconv.ParseInt(countStr, 10, 64)
		if err != nil {
			return Count{}, fmt.Errorf("non-integer count %q: %w", countStr, err)
		}
		entry.Values = append(entry.Values, RangeValue{
			Timestamp: int64(ts),
			Count:     count,
		})
	}

	return entry, nil
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

	entry, err := parseCountLabels(sample.Metric)
	if err != nil {
		return Count{}, err
	}
	entry.Count = count

	return entry, nil
}

// parseCountLabels converts a single Loki MetricSample into a Count.
func parseCountLabels(m map[string]string) (Count, error) {
	entry := Count{}
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
	if v, ok := m["rule_uids"]; ok {
		// Store the raw comma-separated rule_uids string temporarily in the RuleUID
		// field. The explodeRuleUIDCounts function will split and reaggregate later.
		entry.RuleUID = &v
	}
	if v, ok := m["groupLabels_alertname"]; ok && v != "" {
		entry.RuleTitle = &v
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

// buildAlertLabelQuery builds a LogQL query against the alerts stream with label matchers.
// When ruleUID is provided, a structured metadata filter is added before JSON parsing
// so Loki can discard non-matching entries without deserializing the log line.
// After | json, Loki flattens nested label keys so labels.alertname becomes labels_alertname.
func buildAlertLabelQuery(ruleUID *string, labels Matchers) (string, error) {
	logql := fmt.Sprintf(`{%s=%q}`, historian.LabelFrom, historian.LabelFromValueAlerts)

	if ruleUID != nil && *ruleUID != "" {
		if !validRuleUIDRegex.MatchString(*ruleUID) {
			return "", fmt.Errorf("%w: rule uid: %q", ErrInvalidQuery, *ruleUID)
		}
		logql += fmt.Sprintf(` | rule_uid = %q`, *ruleUID)
	}

	logql += ` | json`
	for _, matcher := range labels {
		if !validLabelKeyRegex.MatchString(matcher.Label) {
			return "", fmt.Errorf("%w: label: %q", ErrInvalidQuery, matcher.Label)
		}
		switch matcher.Type {
		case "=", "!=", "=~", "!~":
		default:
			return "", fmt.Errorf("%w: matcher type: %s", ErrInvalidQuery, matcher.Type)
		}
		logql += fmt.Sprintf(` | labels_%s %s %q`, matcher.Label, matcher.Type, matcher.Value)
	}
	return logql, nil
}

// buildAlertUUIDMetricsQuery wraps an alert label LogQL query in a
// sum by (uuid) (count_over_time(...)) aggregation so Loki deduplicates UUIDs server-side.
func buildAlertUUIDMetricsQuery(logqlInner string, from, to time.Time) string {
	rangeSeconds := int64(to.Sub(from).Seconds())
	return fmt.Sprintf(`sum by (uuid) (count_over_time(%s[%ds]))`, logqlInner, rangeSeconds)
}

// runAlertUUIDQuery runs a metrics query against the alerts stream and extracts
// the unique UUIDs from the resulting metric labels. Loki performs deduplication
// server-side via sum by (uuid) (count_over_time(...)).
func (l *LokiReader) runAlertUUIDQuery(ctx context.Context, logql string, from, to time.Time) ([]string, error) {
	metricsLogql := buildAlertUUIDMetricsQuery(logql, from, to)
	r, err := l.client.MetricsQuery(ctx, metricsLogql, to.UnixNano(), maxLimit)
	if err != nil {
		return nil, fmt.Errorf("loki metrics query (alert labels): %w", err)
	}
	var uuids []string
	for _, sample := range r.Data.Result {
		if uuid, ok := sample.Metric["uuid"]; ok && uuid != "" {
			uuids = append(uuids, uuid)
		}
	}
	return uuids, nil
}

// buildQuery creates the LogQL to perform the requested query.
// If uuids is non-empty, an additional filter is added after | json to match
// only notifications with one of the given UUIDs.
func buildQuery(query Query, uuids []string) (string, error) {
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

	// Add UUID filter if specified (used by cross-stream label filtering).
	// uuid is a JSON field on the notifications stream, so this goes after | json.
	if len(uuids) > 0 {
		escaped := make([]string, len(uuids))
		for i, u := range uuids {
			escaped[i] = regexp.QuoteMeta(u)
		}
		logql += fmt.Sprintf(` | uuid =~ %q`, strings.Join(escaped, "|"))
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
