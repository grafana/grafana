package historian

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

type remoteLokiClient interface {
	ping() error
	push([]stream) error
}

type RemoteLokiBackend struct {
	client remoteLokiClient
	log    log.Logger
}

func NewRemoteLokiBackend(cfg LokiConfig) *RemoteLokiBackend {
	logger := log.New("ngalert.state.historian", "backend", "loki")
	return &RemoteLokiBackend{
		client: newLokiClient(cfg, logger),
		log:    logger,
	}
}

func (h *RemoteLokiBackend) TestConnection() error {
	return h.client.ping()
}

func (h *RemoteLokiBackend) RecordStatesAsync(ctx context.Context, rule *models.AlertRule, states []state.StateTransition) {
	logger := h.log.FromContext(ctx)
	streams := h.buildStreams(rule, states, logger)
	h.recordStreamsAsync(ctx, streams, logger)
}

func (h *RemoteLokiBackend) buildStreams(rule *models.AlertRule, states []state.StateTransition, logger log.Logger) []stream {
	buckets := make(map[string][]row) // label hash -> entries
	for _, state := range states {
		if !shouldRecord(state) {
			continue
		}

		labels := removePrivateLabels(state.State.Labels)
		repr := labels.String()

		buckets[repr] = append(buckets[repr], row{
			At:  state.State.LastEvaluationTime,
			Val: state.Formatted(),
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

func (h *RemoteLokiBackend) recordStreamsAsync(ctx context.Context, streams []stream, logger log.Logger) {
	go func() {
		if err := h.recordStreams(ctx, streams, logger); err != nil {
			logger.Error("Failed to save alert state history batch", "error", err)
		}
	}()
}

func (h *RemoteLokiBackend) recordStreams(ctx context.Context, streams []stream, logger log.Logger) error {
	logger.Error("pushing streams", "streams", streams)
	if err := h.client.push(streams); err != nil {
		return err
	}
	logger.Debug("Done saving alert state history batch")
	return nil
}

func (h *RemoteLokiBackend) QueryStates(ctx context.Context, query models.HistoryQuery) (*data.Frame, error) {
	return data.NewFrame("states"), nil
}
