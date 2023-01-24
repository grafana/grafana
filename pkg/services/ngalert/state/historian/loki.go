package historian

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

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
)

const (
	StateHistoryLabelKey   = "from"
	StateHistoryLabelValue = "state-history"
)

type remoteLokiClient interface {
	ping(context.Context) error
	push(context.Context, []stream) error
	query(ctx context.Context, selectors [][3]string, start, end int64) (QueryRes, error)
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
	res, err := h.client.query(ctx, [][3]string{
		{"rule_id", "=", query.RuleUID},
	}, query.From.Unix(), query.To.Unix())
	if err != nil {
		return nil, err
	}
	return merge(res)
}

// merge will put all the results in one array sorted by timestamp.
func merge(res QueryRes) (*data.Frame, error) {
	// Find the total number of elements in all arrays
	totalLen := 0
	for _, arr := range res.Data.Result {
		totalLen += len(arr.Values)
	}
	// Create a new slice to store the merged elements
	df := data.NewFrame("result")
	// Initialize a slice of pointers to the current position in each array
	pointers := make([]int, len(res.Data.Result))
	for {
		// Find the minimum element among all arrays
		minVal := (^int64(0) >> 1) // set initial value to max int
		minIdx := -1
		minEl := [2]string{}
		for i, stream := range res.Data.Result {
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
		// If all pointers have reached the end of their arrays, we're done
		if minIdx == -1 {
			break
		}
		// Append the minimum element to the merged slice and move the pointer
		df.AppendRow(minEl)
		pointers[minIdx]++
	}
	return df, nil
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
