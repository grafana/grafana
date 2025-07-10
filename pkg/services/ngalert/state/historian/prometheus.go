package historian

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/grafana/dataplane/sdata/numeric"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	promValue "github.com/prometheus/prometheus/model/value"
	"github.com/prometheus/prometheus/util/strutil"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// Label names for the alert metric.
	alertNameLabel = "alertname"
	// alertStateLabel is the label used to indicate
	// the Prometheus-style alert state: firing or pending.
	alertStateLabel = "alertstate"
	// grafanaAlertStateLabel is the label used to indicate the Grafana-style
	// alert state: alerting, pending, recovering, etc.
	grafanaAlertStateLabel = "grafana_alertstate"
	alertRuleUIDLabel      = "grafana_rule_uid"
)

// isMetricEmittingState defines which evaluation states should emit ALERTS metrics.
// Basically every state that is not Normal should emit metrics currently,
// and is defined here as an allowed state.
func isMetricEmittingState(state eval.State) bool {
	metricEmittingStates := map[eval.State]struct{}{
		eval.Alerting:   {},
		eval.Pending:    {},
		eval.Recovering: {},
		eval.Error:      {},
		eval.NoData:     {},
	}

	_, ok := metricEmittingStates[state]

	return ok
}

// getPrometheusState maps Grafana states to Prometheus alert states.
// In Prometheus, the alertstate label in the ALERTS metric can be either "firing" or "pending",
// so we need to convert Grafana states accordingly.
func getPrometheusState(grafanaState eval.State) string {
	if grafanaState == eval.Recovering || grafanaState == eval.Alerting || grafanaState == eval.Error || grafanaState == eval.NoData {
		return "firing"
	}

	return strings.ToLower(grafanaState.String())
}

type seriesWriter interface {
	WriteDatasource(ctx context.Context, dsUID string, name string, t time.Time, frames data.Frames, orgID int64, extraLabels map[string]string) error
}

type PrometheusConfig struct {
	DatasourceUID string
	MetricName    string
}

func NewPrometheusConfig(cfg setting.UnifiedAlertingStateHistorySettings) (PrometheusConfig, error) {
	if cfg.PrometheusTargetDatasourceUID == "" {
		return PrometheusConfig{}, errors.New("datasource UID must not be empty")
	}

	if cfg.PrometheusMetricName == "" {
		return PrometheusConfig{}, errors.New("metric name must not be empty")
	}

	return PrometheusConfig{
		DatasourceUID: cfg.PrometheusTargetDatasourceUID,
		MetricName:    cfg.PrometheusMetricName,
	}, nil
}

type RemotePrometheusBackend struct {
	cfg        PrometheusConfig
	promWriter seriesWriter
	logger     log.Logger
	metrics    *metrics.Historian
}

func NewRemotePrometheusBackend(cfg PrometheusConfig, promWriter seriesWriter, logger log.Logger, metrics *metrics.Historian) *RemotePrometheusBackend {
	logger.Info("Initializing remote Prometheus backend", "datasourceUID", cfg.DatasourceUID)

	return &RemotePrometheusBackend{
		cfg:        cfg,
		promWriter: promWriter,
		logger:     logger,
		metrics:    metrics,
	}
}

func (b *RemotePrometheusBackend) Query(ctx context.Context, query models.HistoryQuery) (*data.Frame, error) {
	return nil, fmt.Errorf("prometheus historian backend does not support querying")
}

func (b *RemotePrometheusBackend) Record(ctx context.Context, rule history_model.RuleMeta, transitions []state.StateTransition) <-chan error {
	errCh := make(chan error, 1)

	if len(transitions) == 0 {
		errCh <- nil
		close(errCh)
		return errCh
	}

	logger := b.logger.FromContext(ctx)

	var frames data.Frames

	for _, t := range transitions {
		transitionFrames := b.framesFor(ctx, rule, t)
		frames = append(frames, transitionFrames...)
	}

	if len(frames) == 0 {
		logger.Debug("No frames generated for alert state metric, nothing to write")
		errCh <- nil
		close(errCh)
		return errCh
	}

	st := transitions[0]

	go func() {
		defer func() {
			if r := recover(); r != nil {
				logger.Error("Panic in prometheus historian", "error", r)
				errCh <- fmt.Errorf("prometheus historian panic: %v", r)
			}
			close(errCh)
		}()

		logger.Debug("Saving state history batch", "samples", len(frames))
		org := fmt.Sprint(st.OrgID)
		b.metrics.WritesTotal.WithLabelValues(org, "prometheus").Inc()
		b.metrics.TransitionsTotal.WithLabelValues(org).Add(float64(len(frames)))

		var sendErr error
		if err := b.promWriter.WriteDatasource(ctx, b.cfg.DatasourceUID, b.cfg.MetricName, st.LastEvaluationTime, frames, st.OrgID, nil); err != nil {
			logger.Error("Failed to write alert state metrics batch", "error", err)
			b.metrics.WritesFailed.WithLabelValues(org, "prometheus").Inc()
			b.metrics.TransitionsFailed.WithLabelValues(org).Add(float64(len(frames)))
			sendErr = err
		}
		errCh <- sendErr
	}()

	return errCh
}

// framesFor converts a single StateTransition to multiple data.Frames to handle
// transitions that require both StaleNaN for previous state and active metric for current state.
//
// StaleNaN: in the case of a transition from a metric-emitting state to a non-emitting state,
// or when the series changes from one metric-emitting state to another, we should emit a StaleNaN sample
// for the previous state to stop it in Prometheus:
// https://prometheus.io/docs/specs/prw/remote_write_spec/#stale-markers
func (b *RemotePrometheusBackend) framesFor(ctx context.Context, rule history_model.RuleMeta, t state.StateTransition) []*data.Frame {
	samples := getSamples(t)
	if len(samples) == 0 {
		return nil
	}

	logger := b.logger.FromContext(ctx)

	baseLabels := removePrivateLabels(t.Labels)
	baseLabels[alertRuleUIDLabel] = t.AlertRuleUID
	baseLabels[alertNameLabel] = rule.Title

	frameMeta := &data.FrameMeta{
		Type:        data.FrameTypeNumericMulti,
		TypeVersion: numeric.MultiFrameVersionLatest,
	}

	frames := make([]*data.Frame, len(samples))

	for i, sample := range samples {
		labels := make(data.Labels, len(baseLabels)+2)
		for k, v := range baseLabels {
			sanitizedKey := strutil.SanitizeFullLabelName(k)
			labels[sanitizedKey] = v
		}
		labels[alertStateLabel] = sample.promState
		labels[grafanaAlertStateLabel] = sample.grafanaState

		logger.Debug("Creating metric with labels",
			"rule_uid", t.AlertRuleUID,
			"previous_state", t.PreviousState,
			"current_state", t.State.State,
			"last_evaluation_time", t.LastEvaluationTime,
			"rule_title", rule.Title,
			"labels", labels,
			"value", sample.value,
		)

		field := data.NewField("", labels, []float64{sample.value})
		frames[i] = data.NewFrame(b.cfg.MetricName, field)
		frames[i].SetMeta(frameMeta)
	}

	return frames
}

type sample struct {
	value        float64
	grafanaState string
	promState    string
}

// getSamples generates samples based on the state transition.
func getSamples(tr state.StateTransition) []*sample {
	curr, prev := tr.State.State, tr.PreviousState

	var samples []*sample

	// If transitioning from a metric-emitting state to a different state,
	// emit a StaleNaN sample for the previous state to stop it in Prometheus.
	if isMetricEmittingState(prev) && prev != curr {
		prevState := strings.ToLower(prev.String())
		prevPromState := getPrometheusState(prev)

		samples = append(samples, &sample{
			value:        math.Float64frombits(promValue.StaleNaN),
			grafanaState: prevState,
			promState:    prevPromState,
		})
	}

	if isMetricEmittingState(curr) {
		currState := strings.ToLower(curr.String())
		currPromState := getPrometheusState(curr)

		samples = append(samples, &sample{
			value:        1.0,
			grafanaState: currState,
			promState:    currPromState,
		})
	}

	return samples
}
