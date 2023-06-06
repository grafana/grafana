package historian

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/weaveworks/common/http/client"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
)

const (
	OrgIDLabel     = "orgID"
	RuleUIDLabel   = "ruleUID"
	GroupLabel     = "group"
	FolderUIDLabel = "folderUID"
	// Name of the columns used in the dataframe.
	dfTime   = "time"
	dfLine   = "line"
	dfLabels = "labels"
)

const (
	StateHistoryLabelKey   = "from"
	StateHistoryLabelValue = "state-history"
)

const defaultQueryRange = 6 * time.Hour

type remoteLokiClient interface {
	ping(context.Context) error
	push(context.Context, []stream) error
	rangeQuery(ctx context.Context, logQL string, start, end int64) (queryRes, error)
}

// RemoteLokibackend is a state.Historian that records state history to an external Loki instance.
type RemoteLokiBackend struct {
	client         remoteLokiClient
	externalLabels map[string]string
	clock          clock.Clock
	metrics        *metrics.Historian
	log            log.Logger
}

func NewRemoteLokiBackend(cfg LokiConfig, req client.Requester, metrics *metrics.Historian) *RemoteLokiBackend {
	logger := log.New("ngalert.state.historian", "backend", "loki")
	return &RemoteLokiBackend{
		client:         newLokiClient(cfg, req, metrics, logger),
		externalLabels: cfg.ExternalLabels,
		clock:          clock.New(),
		metrics:        metrics,
		log:            logger,
	}
}

func (h *RemoteLokiBackend) TestConnection(ctx context.Context) error {
	return h.client.ping(ctx)
}

// Record writes a number of state transitions for a given rule to an external Loki instance.
func (h *RemoteLokiBackend) Record(ctx context.Context, rule history_model.RuleMeta, states []state.StateTransition) <-chan error {
	logger := h.log.FromContext(ctx)
	logStream := statesToStream(rule, states, h.externalLabels, logger)

	errCh := make(chan error, 1)
	if len(logStream.Values) == 0 {
		close(errCh)
		return errCh
	}

	// This is a new background job, so let's create a brand new context for it.
	// We want it to be isolated, i.e. we don't want grafana shutdowns to interrupt this work
	// immediately but rather try to flush writes.
	// This also prevents timeouts or other lingering objects (like transactions) from being
	// incorrectly propagated here from other areas.
	writeCtx := context.Background()
	writeCtx, cancel := context.WithTimeout(writeCtx, StateHistoryWriteTimeout)
	writeCtx = history_model.WithRuleData(writeCtx, rule)
	writeCtx = tracing.ContextWithSpan(writeCtx, tracing.SpanFromContext(ctx))

	go func(ctx context.Context) {
		defer cancel()
		defer close(errCh)
		logger := h.log.FromContext(ctx)

		org := fmt.Sprint(rule.OrgID)
		h.metrics.WritesTotal.WithLabelValues(org, "loki").Inc()
		h.metrics.TransitionsTotal.WithLabelValues(org).Add(float64(len(logStream.Values)))

		if err := h.recordStreams(ctx, []stream{logStream}, logger); err != nil {
			logger.Error("Failed to save alert state history batch", "error", err)
			h.metrics.WritesFailed.WithLabelValues(org, "loki").Inc()
			h.metrics.TransitionsFailed.WithLabelValues(org).Add(float64(len(logStream.Values)))
			errCh <- fmt.Errorf("failed to save alert state history batch: %w", err)
		}
	}(writeCtx)
	return errCh
}

// Query retrieves state history entries from an external Loki instance and formats the results into a dataframe.
func (h *RemoteLokiBackend) Query(ctx context.Context, query models.HistoryQuery) (*data.Frame, error) {
	logQL, err := buildLogQuery(query)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	if query.To.IsZero() {
		query.To = now
	}
	if query.From.IsZero() {
		query.From = now.Add(-defaultQueryRange)
	}

	// Timestamps are expected in RFC3339Nano.
	res, err := h.client.rangeQuery(ctx, logQL, query.From.UnixNano(), query.To.UnixNano())
	if err != nil {
		return nil, err
	}
	return merge(res, query.RuleUID)
}

func buildSelectors(query models.HistoryQuery) ([]Selector, error) {
	// OrgID and the state history label are static and will be included in all queries.
	selectors := make([]Selector, 2)

	// Set the predefined selector orgID.
	selector, err := NewSelector(OrgIDLabel, "=", fmt.Sprintf("%d", query.OrgID))
	if err != nil {
		return nil, err
	}
	selectors[0] = selector

	// Set the predefined selector for the state history label.
	selector, err = NewSelector(StateHistoryLabelKey, "=", StateHistoryLabelValue)
	if err != nil {
		return nil, err
	}
	selectors[1] = selector

	// Set the optional special selector rule_id
	if query.RuleUID != "" {
		rsel, err := NewSelector(RuleUIDLabel, "=", query.RuleUID)
		if err != nil {
			return nil, err
		}
		selectors = append(selectors, rsel)
	}

	return selectors, nil
}

// merge will put all the results in one array sorted by timestamp.
func merge(res queryRes, ruleUID string) (*data.Frame, error) {
	// Find the total number of elements in all arrays.
	totalLen := 0
	for _, arr := range res.Data.Result {
		totalLen += len(arr.Values)
	}

	// Create a new slice to store the merged elements.
	frame := data.NewFrame("states")

	// We merge all series into a single linear history.
	lbls := data.Labels(map[string]string{})

	// We represent state history as a single merged history, that roughly corresponds to what you get in the Grafana Explore tab when querying Loki directly.
	// The format is composed of the following vectors:
	//   1. `time` - timestamp - when the transition happened
	//   2. `line` - JSON - the full data of the transition
	//   3. `labels` - JSON - the labels associated with that state transition
	times := make([]time.Time, 0, totalLen)
	lines := make([]json.RawMessage, 0, totalLen)
	labels := make([]json.RawMessage, 0, totalLen)

	// Initialize a slice of pointers to the current position in each array.
	pointers := make([]int, len(res.Data.Result))
	for {
		minTime := int64(math.MaxInt64)
		minEl := sample{}
		minElStreamIdx := -1
		// Find the element with the earliest time among all arrays.
		for i, stream := range res.Data.Result {
			// Skip if we already reached the end of the current array.
			if len(stream.Values) == pointers[i] {
				continue
			}
			curTime := stream.Values[pointers[i]].T.UnixNano()
			if pointers[i] < len(stream.Values) && curTime < minTime {
				minTime = curTime
				minEl = stream.Values[pointers[i]]
				minElStreamIdx = i
			}
		}
		// If all pointers have reached the end of their arrays, we're done.
		if minElStreamIdx == -1 {
			break
		}
		var entry lokiEntry
		err := json.Unmarshal([]byte(minEl.V), &entry)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal entry: %w", err)
		}
		// Append the minimum element to the merged slice and move the pointer.
		tsNano := minEl.T.UnixNano()
		// TODO: In general, perhaps we should omit the offending line and log, rather than failing the request entirely.
		streamLbls := res.Data.Result[minElStreamIdx].Stream
		lblsJson, err := json.Marshal(streamLbls)
		if err != nil {
			return nil, fmt.Errorf("failed to serialize stream labels: %w", err)
		}
		line, err := jsonifyRow(minEl.V)
		if err != nil {
			return nil, fmt.Errorf("a line was in an invalid format: %w", err)
		}

		times = append(times, time.Unix(0, tsNano))
		labels = append(labels, lblsJson)
		lines = append(lines, line)
		pointers[minElStreamIdx]++
	}

	frame.Fields = append(frame.Fields, data.NewField(dfTime, lbls, times))
	frame.Fields = append(frame.Fields, data.NewField(dfLine, lbls, lines))
	frame.Fields = append(frame.Fields, data.NewField(dfLabels, lbls, labels))

	return frame, nil
}

func statesToStream(rule history_model.RuleMeta, states []state.StateTransition, externalLabels map[string]string, logger log.Logger) stream {
	labels := mergeLabels(make(map[string]string), externalLabels)
	// System-defined labels take precedence over user-defined external labels.
	labels[StateHistoryLabelKey] = StateHistoryLabelValue
	labels[OrgIDLabel] = fmt.Sprint(rule.OrgID)
	labels[RuleUIDLabel] = fmt.Sprint(rule.UID)
	labels[GroupLabel] = fmt.Sprint(rule.Group)
	labels[FolderUIDLabel] = fmt.Sprint(rule.NamespaceUID)

	samples := make([]sample, 0, len(states))
	for _, state := range states {
		if !shouldRecord(state) {
			continue
		}

		sanitizedLabels := removePrivateLabels(state.Labels)
		entry := lokiEntry{
			SchemaVersion:  1,
			Previous:       state.PreviousFormatted(),
			Current:        state.Formatted(),
			Values:         valuesAsDataBlob(state.State),
			Condition:      rule.Condition,
			DashboardUID:   rule.DashboardUID,
			PanelID:        rule.PanelID,
			Fingerprint:    labelFingerprint(sanitizedLabels),
			InstanceLabels: sanitizedLabels,
		}
		if state.State.State == eval.Error {
			entry.Error = state.Error.Error()
		}

		jsn, err := json.Marshal(entry)
		if err != nil {
			logger.Error("Failed to construct history record for state, skipping", "error", err)
			continue
		}
		line := string(jsn)

		samples = append(samples, sample{
			T: state.State.LastEvaluationTime,
			V: line,
		})
	}

	return stream{
		Stream: labels,
		Values: samples,
	}
}

func (h *RemoteLokiBackend) recordStreams(ctx context.Context, streams []stream, logger log.Logger) error {
	if err := h.client.push(ctx, streams); err != nil {
		return err
	}

	logger.Debug("Done saving alert state history batch")
	return nil
}

type lokiEntry struct {
	SchemaVersion int              `json:"schemaVersion"`
	Previous      string           `json:"previous"`
	Current       string           `json:"current"`
	Error         string           `json:"error,omitempty"`
	Values        *simplejson.Json `json:"values"`
	Condition     string           `json:"condition"`
	DashboardUID  string           `json:"dashboardUID"`
	PanelID       int64            `json:"panelID"`
	Fingerprint   string           `json:"fingerprint"`
	// InstanceLabels is exactly the set of labels associated with the alert instance in Alertmanager.
	// These should not be conflated with labels associated with log streams.
	InstanceLabels map[string]string `json:"labels"`
}

func valuesAsDataBlob(state *state.State) *simplejson.Json {
	if state.State == eval.Error || state.State == eval.NoData {
		return simplejson.New()
	}

	return jsonifyValues(state.Values)
}

func jsonifyRow(line string) (json.RawMessage, error) {
	// Ser/deser to validate the contents of the log line before shipping it forward.
	// TODO: We may want to remove this in the future, as we already have the value in the form of a []byte, and json.RawMessage is also a []byte.
	// TODO: Though, if the log line does not contain valid JSON, this can cause problems later on when rendering the dataframe.
	var entry lokiEntry
	if err := json.Unmarshal([]byte(line), &entry); err != nil {
		return nil, err
	}
	return json.Marshal(entry)
}

type Selector struct {
	// Label to Select
	Label string
	Op    Operator
	// Value that is expected
	Value string
}

func NewSelector(label, op, value string) (Selector, error) {
	if !isValidOperator(op) {
		return Selector{}, fmt.Errorf("'%s' is not a valid query operator", op)
	}
	return Selector{Label: label, Op: Operator(op), Value: value}, nil
}

func selectorString(selectors []Selector) string {
	if len(selectors) == 0 {
		return "{}"
	}
	// Build the query selector.
	query := ""
	for _, s := range selectors {
		query += fmt.Sprintf("%s%s%q,", s.Label, s.Op, s.Value)
	}
	// Remove the last comma, as we append one to every selector.
	query = query[:len(query)-1]
	return "{" + query + "}"
}

func isValidOperator(op string) bool {
	switch op {
	case "=", "!=", "=~", "!~":
		return true
	}
	return false
}

func buildLogQuery(query models.HistoryQuery) (string, error) {
	selectors, err := buildSelectors(query)
	if err != nil {
		return "", fmt.Errorf("failed to build the provided selectors: %w", err)
	}

	logQL := selectorString(selectors)

	labelFilters := ""
	labelKeys := make([]string, 0, len(query.Labels))
	for k := range query.Labels {
		labelKeys = append(labelKeys, k)
	}
	// Ensure that all queries we build are deterministic.
	sort.Strings(labelKeys)
	for _, k := range labelKeys {
		labelFilters += fmt.Sprintf(" | labels_%s=%q", k, query.Labels[k])
	}

	if labelFilters != "" {
		logQL = fmt.Sprintf("%s | json%s", logQL, labelFilters)
	}

	return logQL, nil
}
