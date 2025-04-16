package metricwriter

import (
	"context"
	"errors"
	"math"
	"strings"
	"time"

	"github.com/grafana/dataplane/sdata/numeric"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	promValue "github.com/prometheus/prometheus/model/value"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/state/metricwriter/model"
)

const (
	// AlertMetricName is the metric name for synthetic alert timeseries.
	alertMetricName = "ALERTS"

	// Label names for the alert metric.
	alertNameLabel = "alertname"
	// alertStateLabel is the label used to indicate the Prometheus-style alert state: firing or pending.
	alertStateLabel = "alertstate"
	// grafanaAlertStateLabel is the label used to indicate the Grafana-style alert state: alerting, pending, recovering.
	grafanaAlertStateLabel = "grafana_alertstate"
	alertRuleUIDLabel      = "rule_uid"
)

type seriesWriter interface {
	WriteDatasource(ctx context.Context, dsUID string, name string, t time.Time, frames data.Frames, orgID int64, extraLabels map[string]string) error
}

type Config struct {
	DatasourceUID string
}

func (c Config) Validate() error {
	if c.DatasourceUID == "" {
		return errors.New("datasource UID must not be empty")
	}
	return nil
}

type Writer struct {
	cfg        Config
	promWriter seriesWriter
	logger     log.Logger
}

func NewWriter(cfg Config, promWriter seriesWriter, logger log.Logger) (*Writer, error) {
	logger.Info("Initializing Writer", "datasourceUID", cfg.DatasourceUID)

	return &Writer{
		cfg:        cfg,
		promWriter: promWriter,
		logger:     logger,
	}, nil
}

func (w *Writer) Write(ctx context.Context, ruleMeta model.RuleMeta, transitions state.StateTransitions) <-chan error {
	errCh := make(chan error, 1)

	if len(transitions) == 0 {
		errCh <- nil
		close(errCh)
		return errCh
	}

	logger := w.logger.FromContext(ctx)

	frames := make(data.Frames, 0, len(transitions))

	for _, t := range transitions {
		if frame := w.frameFor(ctx, ruleMeta, t); frame != nil {
			frames = append(frames, frame)
		}
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

		if err := w.promWriter.WriteDatasource(ctx, w.cfg.DatasourceUID, alertMetricName, st.LastEvaluationTime, frames, st.OrgID, nil); err != nil {
			logger.Error("Failed to write alert state metrics batch", "error", err)
			sendErr = err
		}
		errCh <- sendErr
	}()

	return errCh
}

// frameFor converts a single StateTransition to a data.Frame or returns nil if
// the transition should not generate any metrics (e.g. Normal → Normal).
func (w *Writer) frameFor(ctx context.Context, ruleMeta model.RuleMeta, t state.StateTransition) *data.Frame {
	sample, ok := getSample(t)
	if !ok {
		return nil
	}

	logger := w.logger.FromContext(ctx)

	labels := make(data.Labels, len(t.Labels)+4)
	for k, v := range t.Labels {
		if strings.HasPrefix(k, "__") && strings.HasSuffix(k, "__") {
			continue // skipping internal Grafana labels
		}
		labels[k] = v
	}

	labels[alertRuleUIDLabel] = t.AlertRuleUID
	labels[alertNameLabel] = ruleMeta.Title
	labels[alertStateLabel] = sample.promState
	labels[grafanaAlertStateLabel] = sample.grafanaState

	logger.Debug("Creating metric with labels",
		"rule_uid", t.AlertRuleUID,
		"previous_state", t.PreviousState,
		"current_state", t.State.State,
		"last_evaluation_time", t.LastEvaluationTime,
		"rule_title", ruleMeta.Title,
		"labels", labels,
		"value", sample.value,
	)

	field := data.NewField("", labels, []float64{sample.value})

	f := data.NewFrame(alertMetricName, field)
	f.SetMeta(&data.FrameMeta{
		Type:        data.FrameTypeNumericMulti,
		TypeVersion: numeric.MultiFrameVersionLatest,
	})

	return f
}

type sample struct {
	value        float64
	grafanaState string
	promState    string
}

// getSample determines whether a transition should emit a sample, and if so,
// returns its value and boolean indicating whether it should be emitted.
func getSample(tr state.StateTransition) (*sample, bool) {
	curr, prev := tr.State.State, tr.PreviousState

	var (
		state string
		value float64
	)

	switch {
	case curr == eval.Alerting || curr == eval.Recovering || curr == eval.Pending:
		state = strings.ToLower(curr.String())
		value = 1.0
	case curr == eval.Normal && (prev == eval.Alerting || prev == eval.Recovering || prev == eval.Pending):
		// If this is a transition from Alerting/Recovering/Pending to Normal,
		// we emit a sample with the previous alerting state labels, but with a special
		// StaleNaN value: https://prometheus.io/docs/specs/prw/remote_write_spec/#stale-markers
		state = strings.ToLower(prev.String())
		value = math.Float64frombits(promValue.StaleNaN)
	}

	if value == 0 {
		return nil, false
	}

	promState := state
	if state == "recovering" || state == "alerting" {
		promState = "firing"
	}

	return &sample{
		value:        value,
		grafanaState: state,
		promState:    promState,
	}, true
}
