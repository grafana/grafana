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

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	// Label names for the alert metric.
	alertNameLabel = "alertname"
	// alertStateLabel is the label used to indicate the Prometheus-style alert state: firing or pending.
	alertStateLabel = "alertstate"
	// grafanaAlertStateLabel is the label used to indicate the Grafana-style alert state: alerting, pending, recovering.
	grafanaAlertStateLabel = "grafana_alertstate"
	alertRuleUIDLabel      = "grafana_rule_uid"
)

// isMetricEmittingState defines which evaluation states should emit ALERTS metrics
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

// getPrometheusState maps Grafana states to Prometheus alert states
func getPrometheusState(grafanaState eval.State) string {
	if grafanaState == eval.Recovering || grafanaState == eval.Alerting {
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
}

func NewRemotePrometheusBackend(cfg PrometheusConfig, promWriter seriesWriter, logger log.Logger) *RemotePrometheusBackend {
	logger.Info("Initializing remote Prometheus backend", "datasourceUID", cfg.DatasourceUID)

	return &RemotePrometheusBackend{
		cfg:        cfg,
		promWriter: promWriter,
		logger:     logger,
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
		defer close(errCh)
		var sendErr error

		if err := b.promWriter.WriteDatasource(ctx, b.cfg.DatasourceUID, b.cfg.MetricName, st.LastEvaluationTime, frames, st.OrgID, nil); err != nil {
			logger.Error("Failed to write alert state metrics batch", "error", err)
			sendErr = err
		}
		errCh <- sendErr
	}()

	return errCh
}

// framesFor converts a single StateTransition to multiple data.Frames to handle
// transitions that require both StaleNaN for previous state and active metric for current state.
func (b *RemotePrometheusBackend) framesFor(ctx context.Context, rule history_model.RuleMeta, t state.StateTransition) []*data.Frame {
	samples, ok := getSamples(t)
	if !ok {
		return nil
	}

	logger := b.logger.FromContext(ctx)
	frames := make([]*data.Frame, 0, len(samples))

	for _, sample := range samples {
		labels := make(data.Labels, len(t.Labels)+4)
		for k, v := range t.Labels {
			if strings.HasPrefix(k, "__") && strings.HasSuffix(k, "__") {
				continue // skipping internal Grafana labels
			}
			labels[k] = v
		}

		labels[alertRuleUIDLabel] = t.AlertRuleUID
		labels[alertNameLabel] = rule.Title
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

		f := data.NewFrame(b.cfg.MetricName, field)
		f.SetMeta(&data.FrameMeta{
			Type:        data.FrameTypeNumericMulti,
			TypeVersion: numeric.MultiFrameVersionLatest,
		})

		frames = append(frames, f)
	}

	return frames
}

type sample struct {
	value        float64
	grafanaState string
	promState    string
}

// getSamples determines whether a transition should emit samples, and if so,
// returns them. Returns multiple samples when transitioning between non-Normal states
// to properly mark the previous state as stale.
func getSamples(tr state.StateTransition) ([]*sample, bool) {
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

	// If current state is metric-emitting, emit an active sample
	if isMetricEmittingState(curr) {
		currState := strings.ToLower(curr.String())
		currPromState := getPrometheusState(curr)

		samples = append(samples, &sample{
			value:        1.0,
			grafanaState: currState,
			promState:    currPromState,
		})
	}

	return samples, len(samples) > 0
}
