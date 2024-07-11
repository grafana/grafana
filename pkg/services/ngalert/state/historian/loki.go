package historian

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/client"
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

var (
	ErrLokiQueryTooLong = errutil.BadRequest("loki.requestTooLong").MustTemplate(
		"Request to Loki exceeded ({{.Public.QuerySize}} bytes) configured maximum size of {{.Public.MaxLimit}} bytes",
		errutil.WithPublic("Query for Loki exceeded the configured limit of {{.Public.MaxLimit}} bytes. Remove some filters and try again."),
	)
)

func NewErrLokiQueryTooLong(query string, maxLimit int) error {
	return ErrLokiQueryTooLong.Build(errutil.TemplateData{
		Private: map[string]any{
			"query": query,
		},
		Public: map[string]any{
			"MaxLimit":  maxLimit,
			"QuerySize": len(query),
		},
	})
}

type remoteLokiClient interface {
	Ping(context.Context) error
	Push(context.Context, []Stream) error
	RangeQuery(ctx context.Context, logQL string, start, end, limit int64) (QueryRes, error)
	MaxQuerySize() int
}

// RemoteLokibackend is a state.Historian that records state history to an external Loki instance.
type RemoteLokiBackend struct {
	client         remoteLokiClient
	externalLabels map[string]string
	clock          clock.Clock
	metrics        *metrics.Historian
	log            log.Logger
	ac             AccessControl
	ruleStore      RuleStore
}

func NewRemoteLokiBackend(logger log.Logger, cfg LokiConfig, req client.Requester, metrics *metrics.Historian, tracer tracing.Tracer, ruleStore RuleStore, ac AccessControl) *RemoteLokiBackend {
	return &RemoteLokiBackend{
		client:         NewLokiClient(cfg, req, metrics, logger, tracer),
		externalLabels: cfg.ExternalLabels,
		clock:          clock.New(),
		metrics:        metrics,
		log:            logger,
		ac:             ac,
		ruleStore:      ruleStore,
	}
}

func (h *RemoteLokiBackend) TestConnection(ctx context.Context) error {
	return h.client.Ping(ctx)
}

// Record writes a number of state transitions for a given rule to an external Loki instance.
func (h *RemoteLokiBackend) Record(ctx context.Context, rule history_model.RuleMeta, states []state.StateTransition) <-chan error {
	logger := h.log.FromContext(ctx)
	logStream := StatesToStream(rule, states, h.externalLabels, logger)

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
	writeCtx = trace.ContextWithSpan(writeCtx, trace.SpanFromContext(ctx))

	go func(ctx context.Context) {
		defer cancel()
		defer close(errCh)
		logger := h.log.FromContext(ctx)

		org := fmt.Sprint(rule.OrgID)
		h.metrics.WritesTotal.WithLabelValues(org, "loki").Inc()
		h.metrics.TransitionsTotal.WithLabelValues(org).Add(float64(len(logStream.Values)))

		if err := h.recordStreams(ctx, []Stream{logStream}, logger); err != nil {
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
	uids, err := h.getFolderUIDsForFilter(ctx, query)
	if err != nil {
		return nil, err
	}

	logQL, filterByFolderSkipped, err := BuildLogQuery(query, uids, h.client.MaxQuerySize())
	if err != nil {
		return nil, err
	}
	if filterByFolderSkipped {
		h.log.FromContext(ctx).Warn("Filter by folder skipped because it's too long. Use in-memory filtering", "folders", len(uids))
	}

	now := time.Now().UTC()
	if query.To.IsZero() {
		query.To = now
	}
	if query.From.IsZero() {
		query.From = now.Add(-defaultQueryRange)
	}

	// Timestamps are expected in RFC3339Nano.
	res, err := h.client.RangeQuery(ctx, logQL, query.From.UnixNano(), query.To.UnixNano(), int64(query.Limit))
	if err != nil {
		return nil, err
	}
	return merge(res, uids)
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

	return selectors, nil
}

// merge will put all the results in one array sorted by timestamp.
func merge(res QueryRes, folderUIDToFilter []string) (*data.Frame, error) {
	filterByFolderUIDMap := make(map[string]struct{}, len(folderUIDToFilter))
	for _, uid := range folderUIDToFilter {
		filterByFolderUIDMap[uid] = struct{}{}
	}

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
		minEl := Sample{}
		minElStreamIdx := -1
		// Find the element with the earliest time among all arrays.
		for i, stream := range res.Data.Result {
			// Skip if we already reached the end of the current array.
			if len(stream.Values) == pointers[i] {
				continue
			}
			// check if stream should be in the results
			if len(filterByFolderUIDMap) > 0 {
				folderLbl, ok := stream.Stream[FolderUIDLabel]
				if !ok {
					continue // skip entries without folder UID, only if needs filtering
				}
				_, ok = filterByFolderUIDMap[folderLbl]
				if !ok {
					continue
				}
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
		var entry LokiEntry
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

func StatesToStream(rule history_model.RuleMeta, states []state.StateTransition, externalLabels map[string]string, logger log.Logger) Stream {
	labels := mergeLabels(make(map[string]string), externalLabels)
	// System-defined labels take precedence over user-defined external labels.
	labels[StateHistoryLabelKey] = StateHistoryLabelValue
	labels[OrgIDLabel] = fmt.Sprint(rule.OrgID)
	labels[GroupLabel] = fmt.Sprint(rule.Group)
	labels[FolderUIDLabel] = fmt.Sprint(rule.NamespaceUID)

	samples := make([]Sample, 0, len(states))
	for _, state := range states {
		if !shouldRecord(state) {
			continue
		}

		sanitizedLabels := removePrivateLabels(state.Labels)
		entry := LokiEntry{
			SchemaVersion:  1,
			Previous:       state.PreviousFormatted(),
			Current:        state.Formatted(),
			Values:         valuesAsDataBlob(state.State),
			Condition:      rule.Condition,
			DashboardUID:   rule.DashboardUID,
			PanelID:        rule.PanelID,
			Fingerprint:    labelFingerprint(sanitizedLabels),
			RuleTitle:      rule.Title,
			RuleID:         rule.ID,
			RuleUID:        rule.UID,
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

		samples = append(samples, Sample{
			T: state.State.LastEvaluationTime,
			V: line,
		})
	}

	return Stream{
		Stream: labels,
		Values: samples,
	}
}

func (h *RemoteLokiBackend) recordStreams(ctx context.Context, streams []Stream, logger log.Logger) error {
	if err := h.client.Push(ctx, streams); err != nil {
		return err
	}

	logger.Debug("Done saving alert state history batch")
	return nil
}

type LokiEntry struct {
	SchemaVersion int              `json:"schemaVersion"`
	Previous      string           `json:"previous"`
	Current       string           `json:"current"`
	Error         string           `json:"error,omitempty"`
	Values        *simplejson.Json `json:"values"`
	Condition     string           `json:"condition"`
	DashboardUID  string           `json:"dashboardUID"`
	PanelID       int64            `json:"panelID"`
	Fingerprint   string           `json:"fingerprint"`
	RuleTitle     string           `json:"ruleTitle"`
	RuleID        int64            `json:"ruleID"`
	RuleUID       string           `json:"ruleUID"`
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
	var entry LokiEntry
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

func selectorString(selectors []Selector, folderUIDs []string) string {
	if len(selectors) == 0 {
		return "{}"
	}
	// Build the query selector.
	query := ""
	for _, s := range selectors {
		query += fmt.Sprintf("%s%s%q,", s.Label, s.Op, s.Value)
	}

	if len(folderUIDs) > 0 {
		b := strings.Builder{}
		b.Grow(len(folderUIDs)*40 + len(FolderUIDLabel)) // rough estimate of the length
		b.WriteString(FolderUIDLabel)
		b.WriteString("=~`")
		b.WriteString(regexp.QuoteMeta(folderUIDs[0]))
		for _, uid := range folderUIDs[1:] {
			b.WriteString("|")
			b.WriteString(regexp.QuoteMeta(uid))
		}
		b.WriteString("`")
		query += b.String()
	} else {
		// Remove the last comma, as we append one to every selector.
		query = query[:len(query)-1]
	}
	return "{" + query + "}"
}

func isValidOperator(op string) bool {
	switch op {
	case "=", "!=", "=~", "!~":
		return true
	}
	return false
}

// BuildLogQuery converts models.HistoryQuery and a list of folder UIDs to a Loki query.
// If query size exceeds the `maxQuerySize` then it re-builds query ignoring the folderUIDs. If it's still bigger - returns ErrQueryTooLong.
// Returns a tuple:
// - loki query
// - true if filter by folder UID was not added to the query ignored
// - error if log query cannot be constructed, and ErrQueryTooLong if user-defined query exceeds maximum allowed size
func BuildLogQuery(query models.HistoryQuery, folderUIDs []string, maxQuerySize int) (string, bool, error) {
	selectors, err := buildSelectors(query)
	if err != nil {
		return "", false, fmt.Errorf("failed to build the provided selectors: %w", err)
	}

	logQL := selectorString(selectors, folderUIDs)

	if queryHasLogFilters(query) {
		logQL = fmt.Sprintf("%s | json", logQL)
	}

	if query.RuleUID != "" {
		logQL = fmt.Sprintf("%s | ruleUID=%q", logQL, query.RuleUID)
	}
	if query.DashboardUID != "" {
		logQL = fmt.Sprintf("%s | dashboardUID=%q", logQL, query.DashboardUID)
	}
	if query.PanelID != 0 {
		logQL = fmt.Sprintf("%s | panelID=%d", logQL, query.PanelID)
	}

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
	logQL += labelFilters

	if len(logQL) > maxQuerySize {
		// if request is too long, try to drop filter by folder UIDs.
		if len(folderUIDs) > 0 {
			logQL, tooLong, err := BuildLogQuery(query, nil, maxQuerySize)
			if err != nil {
				return "", false, err
			}
			if tooLong {
				return "", false, NewErrLokiQueryTooLong(logQL, maxQuerySize)
			}
			return logQL, true, nil
		}
		// if the query is too long even without filter by folders, then fail
		return "", false, NewErrLokiQueryTooLong(logQL, maxQuerySize)
	}

	return logQL, false, nil
}

func queryHasLogFilters(query models.HistoryQuery) bool {
	return query.RuleUID != "" ||
		query.DashboardUID != "" ||
		query.PanelID != 0 ||
		len(query.Labels) > 0
}

func (h *RemoteLokiBackend) getFolderUIDsForFilter(ctx context.Context, query models.HistoryQuery) ([]string, error) {
	bypass, err := h.ac.CanReadAllRules(ctx, query.SignedInUser)
	if err != nil {
		return nil, err
	}
	if bypass { // if user has access to all rules and folder, remove filter
		return nil, nil
	}
	// if there is a filter by rule UID, find that rule UID and make sure that user has access to it.
	if query.RuleUID != "" {
		rule, err := h.ruleStore.GetAlertRuleByUID(ctx, &models.GetAlertRuleByUIDQuery{
			UID:   query.RuleUID,
			OrgID: query.OrgID,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to fetch alert rule by UID: %w", err)
		}
		if rule == nil {
			return nil, models.ErrAlertRuleNotFound
		}
		return nil, h.ac.AuthorizeAccessInFolder(ctx, query.SignedInUser, rule)
	}
	// if no filter, then we need to get all namespaces user has access to
	folders, err := h.ruleStore.GetUserVisibleNamespaces(ctx, query.OrgID, query.SignedInUser)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch folders that user can access: %w", err)
	}
	uids := make([]string, 0, len(folders))
	// now keep only UIDs of folder in which user can read rules.
	for _, f := range folders {
		hasAccess, err := h.ac.HasAccessInFolder(ctx, query.SignedInUser, models.Namespace(*f))
		if err != nil {
			return nil, err
		}
		if !hasAccess {
			continue
		}
		uids = append(uids, f.UID)
	}
	if len(uids) == 0 {
		return nil, accesscontrol.NewAuthorizationErrorGeneric("read rules in any folder")
	}
	return uids, nil
}
