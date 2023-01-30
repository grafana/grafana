package historian

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
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
	dfTime = "time"
	dfText = "text"
	dfPrev = "prev"
	dfNext = "next"
	dfData = "data"
)

const (
	StateHistoryLabelKey   = "from"
	StateHistoryLabelValue = "state-history"
)

type remoteLokiClient interface {
	ping(context.Context) error
	push(context.Context, []stream) error
	query(ctx context.Context, selectors []Selector, start, end int64) (QueryRes, error)
}

type RemoteLokiBackend struct {
	client         remoteLokiClient
	externalLabels map[string]string
	log            log.Logger
}

func NewRemoteLokiBackend(cfg LokiConfig) *RemoteLokiBackend {
	logger := log.New("ngalert.state.historian", "backend", "loki")
	return &RemoteLokiBackend{
		client:         newLokiClient(cfg, logger),
		externalLabels: cfg.ExternalLabels,
		log:            logger,
	}
}

func (h *RemoteLokiBackend) TestConnection(ctx context.Context) error {
	return h.client.ping(ctx)
}

func (h *RemoteLokiBackend) RecordStatesAsync(ctx context.Context, rule history_model.RuleMeta, states []state.StateTransition) <-chan error {
	logger := h.log.FromContext(ctx)
	streams := statesToStreams(rule, states, h.externalLabels, logger)
	errCh := make(chan error, 1)
	go func() {
		defer close(errCh)
		if err := h.recordStreams(ctx, streams, logger); err != nil {
			logger.Error("Failed to save alert state history batch", "error", err)
			errCh <- fmt.Errorf("failed to save alert state history batch: %w", err)
		}
	}()
	return errCh
}

func (h *RemoteLokiBackend) QueryStates(ctx context.Context, query models.HistoryQuery) (*data.Frame, error) {
	if query.RuleUID == "" {
		return nil, errors.New("the RuleUID is not set but required")
	}
	selectors, err := buildSelectors(query)
	if err != nil {
		return nil, fmt.Errorf("failed to build the provided selectors: %w", err)
	}
	// Timestamps are expected in RFC3339Nano.
	res, err := h.client.query(ctx, selectors, query.From.UnixNano(), query.To.UnixNano())
	if err != nil {
		return nil, err
	}
	return merge(res, query.RuleUID)
}

func buildSelectors(query models.HistoryQuery) ([]Selector, error) {
	// +2 as we put the RuleID and OrgID also into a label selector.
	selectors := make([]Selector, len(query.Labels)+2)

	// Set the predefined selector rule_id
	selector, err := NewSelector("rule_id", "=", query.RuleUID)
	if err != nil {
		return nil, err
	}
	selectors[0] = selector

	// Set the predefined selector org_id
	selector, err = NewSelector("org_id", "=", fmt.Sprintf("%d", query.OrgID))
	if err != nil {
		return nil, err
	}
	selectors[1] = selector

	// Set all the other selectors
	i := 2
	for label, val := range query.Labels {
		selector, err = NewSelector(label, "=", val)
		if err != nil {
			return nil, err
		}
		selectors[i] = selector
		i++
	}
	return selectors, nil
}

// merge will put all the results in one array sorted by timestamp.
func merge(res QueryRes, ruleUID string) (*data.Frame, error) {
	// Find the total number of elements in all arrays.
	totalLen := 0
	for _, arr := range res.Data.Result {
		totalLen += len(arr.Values)
	}

	// Create a new slice to store the merged elements.
	frame := data.NewFrame("states")

	// Since we are guaranteed to have a single rule, we can return it as a single series.
	// This might change in a later point in time.
	lbls := data.Labels(map[string]string{
		"from":    "state-history",
		"ruleUID": ruleUID,
	})

	// We represent state history as five vectors:
	//   1. `time` - when the transition happened
	//   2. `text` - only used in annotations
	//   3. `prev` - the previous state and reason
	//   4. `next` - the next state and reason
	//   5. `data` - a JSON string, containing the values
	times := make([]time.Time, 0, totalLen)
	texts := make([]string, 0, totalLen)
	prevStates := make([]string, 0, totalLen)
	nextStates := make([]string, 0, totalLen)
	values := make([]string, 0, totalLen)

	// Initialize a slice of pointers to the current position in each array.
	pointers := make([]int, len(res.Data.Result))
	for {
		minVal := int64(math.MaxInt64)
		minIdx := -1
		minEl := [2]string{}
		// Find the minimum element among all arrays.
		for i, stream := range res.Data.Result {
			// Skip if we already reached the end of the current array.
			if len(stream.Values) == pointers[i] {
				continue
			}
			curVal, err := strconv.ParseInt(stream.Values[pointers[i]][0], 10, 64)
			if err != nil {
				return nil, fmt.Errorf("failed to parse timestamp from loki repsonse: %w", err)
			}
			if pointers[i] < len(stream.Values) && curVal < minVal {
				minVal = curVal
				minEl = stream.Values[pointers[i]]
				minIdx = i
			}
		}
		// If all pointers have reached the end of their arrays, we're done.
		if minIdx == -1 {
			break
		}
		var entry lokiEntry
		json.Unmarshal([]byte(minEl[1]), &entry)
		// Append the minimum element to the merged slice and move the pointer.
		ts, err := strconv.ParseInt(minEl[0], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("failed to parse timestampe in response: %w", err)
		}
		value, err := entry.Values.MarshalJSON()
		if err != nil {
			return nil, fmt.Errorf("failed to parse values in response: %w", err)
		}
		times = append(times, time.Unix(ts, 0))
		texts = append(texts, minEl[1])
		prevStates = append(prevStates, entry.Previous)
		nextStates = append(nextStates, entry.Current)
		values = append(values, string(value))
		pointers[minIdx]++
	}

	frame.Fields = append(frame.Fields, data.NewField(dfTime, lbls, times))
	frame.Fields = append(frame.Fields, data.NewField(dfText, lbls, texts))
	frame.Fields = append(frame.Fields, data.NewField(dfPrev, lbls, prevStates))
	frame.Fields = append(frame.Fields, data.NewField(dfNext, lbls, nextStates))
	frame.Fields = append(frame.Fields, data.NewField(dfData, lbls, values))

	return frame, nil
}

func statesToStreams(rule history_model.RuleMeta, states []state.StateTransition, externalLabels map[string]string, logger log.Logger) []stream {
	buckets := make(map[string][]row) // label repr -> entries
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
		repr := labels.String()

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

		buckets[repr] = append(buckets[repr], row{
			At:  state.State.LastEvaluationTime,
			Val: line,
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
