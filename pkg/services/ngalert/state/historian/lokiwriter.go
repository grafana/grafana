package historian

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/benbjohnson/clock"
	alertingInstrument "github.com/grafana/alerting/http/instrument"
	"github.com/grafana/alerting/notify/historian/lokiclient"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
)

type LokiWriter struct {
	client         remoteLokiClient
	externalLabels map[string]string
	clock          clock.Clock
	metrics        *metrics.Historian
	log            log.Logger
}

func NewLokiWriter(logger log.Logger, cfg lokiclient.LokiConfig, req alertingInstrument.Requester, metrics *metrics.Historian, tracer tracing.Tracer) *LokiWriter {
	client := lokiclient.NewLokiClient(cfg, req, metrics.BytesWritten, metrics.WriteDuration, logger, tracer, LokiClientSpanName)
	return &LokiWriter{
		client:         client,
		externalLabels: cfg.ExternalLabels,
		clock:          clock.New(),
		metrics:        metrics,
		log:            logger,
	}
}

func (h *LokiWriter) TestConnection(ctx context.Context) error {
	return h.client.Ping(ctx)
}

// Record writes a number of state transitions for a given rule to an external Loki instance.
func (h *LokiWriter) Record(ctx context.Context, rule history_model.RuleMeta, states []state.StateTransition) <-chan error {
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
		logger.Debug("Saving state history batch", "samples", len(logStream.Values))
		org := fmt.Sprint(rule.OrgID)
		h.metrics.WritesTotal.WithLabelValues(org, "loki").Inc()
		h.metrics.TransitionsTotal.WithLabelValues(org).Add(float64(len(logStream.Values)))

		if err := h.recordStreams(ctx, logStream, logger); err != nil {
			logger.Error("Failed to save alert state history batch", "error", err)
			h.metrics.WritesFailed.WithLabelValues(org, "loki").Inc()
			h.metrics.TransitionsFailed.WithLabelValues(org).Add(float64(len(logStream.Values)))
			errCh <- fmt.Errorf("failed to save alert state history batch: %w", err)
		}
	}(writeCtx)
	return errCh
}

func (h *LokiWriter) recordStreams(ctx context.Context, stream lokiclient.Stream, logger log.Logger) error {
	if err := h.client.Push(ctx, []lokiclient.Stream{stream}); err != nil {
		return err
	}

	logger.Debug("Done saving alert state history batch", "samples", len(stream.Values))
	return nil
}

func StatesToStream(rule history_model.RuleMeta, states []state.StateTransition, externalLabels map[string]string, logger log.Logger) lokiclient.Stream {
	labels := mergeLabels(make(map[string]string), externalLabels)
	// System-defined labels take precedence over user-defined external labels.
	labels[StateHistoryLabelKey] = StateHistoryLabelValue
	labels[OrgIDLabel] = fmt.Sprint(rule.OrgID)
	labels[GroupLabel] = fmt.Sprint(rule.Group)
	labels[FolderUIDLabel] = fmt.Sprint(rule.NamespaceUID)

	samples := make([]lokiclient.Sample, 0, len(states))
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

		samples = append(samples, lokiclient.Sample{
			T: state.LastEvaluationTime,
			V: line,
		})
	}

	return lokiclient.Stream{
		Stream: labels,
		Values: samples,
	}
}

func valuesAsDataBlob(state *state.State) *simplejson.Json {
	if state.State == eval.Error || state.State == eval.NoData {
		return simplejson.New()
	}

	return jsonifyValues(state.Values)
}
