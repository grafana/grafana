package historian

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/weaveworks/common/http/client"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
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
	rangeQuery(ctx context.Context, selectors []Selector, start, end int64) (queryRes, error)
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
	streams := statesToStreams(rule, states, h.externalLabels, logger)

	errCh := make(chan error, 1)
	if len(streams) == 0 {
		close(errCh)
		return errCh
	}

	go func() {
		defer close(errCh)

		org := fmt.Sprint(rule.OrgID)
		h.metrics.WritesTotal.WithLabelValues(org).Inc()
		samples := 0
		for _, s := range streams {
			samples += len(s.Values)
		}
		h.metrics.TransitionsTotal.WithLabelValues(org).Add(float64(samples))

		if err := h.recordStreams(ctx, streams, logger); err != nil {
			logger.Error("Failed to save alert state history batch", "error", err)
			h.metrics.WritesFailed.WithLabelValues(org).Inc()
			h.metrics.TransitionsFailed.WithLabelValues(org).Add(float64(samples))
			errCh <- fmt.Errorf("failed to save alert state history batch: %w", err)
		}
	}()
	return errCh
}

// Query retrieves state history entries from an external Loki instance and formats the results into a dataframe.
func (h *RemoteLokiBackend) Query(ctx context.Context, query models.HistoryQuery) (*data.Frame, error) {
	selectors, err := buildSelectors(query)
	if err != nil {
		return nil, fmt.Errorf("failed to build the provided selectors: %w", err)
	}

	now := time.Now().UTC()
	if query.To.IsZero() {
		query.To = now
	}
	if query.From.IsZero() {
		query.From = now.Add(-defaultQueryRange)
	}

	// Timestamps are expected in RFC3339Nano.
	res, err := h.client.rangeQuery(ctx, selectors, query.From.UnixNano(), query.To.UnixNano())
	if err != nil {
		return nil, err
	}
	return merge(res, query.RuleUID)
}

func buildSelectors(query models.HistoryQuery) ([]Selector, error) {
	// +2 as OrgID and the state history label will always be selectors at the API level.
	selectors := make([]Selector, len(query.Labels)+2)

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

	// Set the label selectors
	i := 2
	for label, val := range query.Labels {
		selector, err = NewSelector(label, "=", val)
		if err != nil {
			return nil, err
		}
		selectors[i] = selector
		i++
	}

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

func statesToStreams(rule history_model.RuleMeta, states []state.StateTransition, externalLabels map[string]string, logger log.Logger) []stream {
	buckets := make(map[string][]sample) // label repr (JSON) -> entries
	for _, state := range states {
		if !shouldRecord(state) {
			continue
		}

		labels := mergeLabels(removePrivateLabels(state.State.Labels), externalLabels)
		labels[StateHistoryLabelKey] = StateHistoryLabelValue
		labels[OrgIDLabel] = fmt.Sprint(rule.OrgID)
		labels[RuleUIDLabel] = fmt.Sprint(rule.UID)
		labels[GroupLabel] = fmt.Sprint(rule.Group)
		labels[FolderUIDLabel] = fmt.Sprint(rule.NamespaceUID)
		lblJsn, err := json.Marshal(labels)
		if err != nil {
			logger.Error("Failed to marshal labels to JSON", "error", err)
			continue
		}
		repr := string(lblJsn)

		entry := lokiEntry{
			SchemaVersion: 1,
			Previous:      state.PreviousFormatted(),
			Current:       state.Formatted(),
			Values:        valuesAsDataBlob(state.State),
			DashboardUID:  rule.DashboardUID,
			PanelID:       rule.PanelID,
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

		buckets[repr] = append(buckets[repr], sample{
			T: state.State.LastEvaluationTime,
			V: line,
		})
	}

	result := make([]stream, 0, len(buckets))
	for repr, rows := range buckets {
		labels, err := data.LabelsFromString(repr)
		if err != nil {
			logger.Error("Failed to parse frame labels, skipping state history batch: %w", err)
			continue
		}
		result = append(result, stream{
			Stream: labels,
			Values: rows,
		})
	}

	return result
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
	DashboardUID  string           `json:"dashboardUID"`
	PanelID       int64            `json:"panelID"`
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
