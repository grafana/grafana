package historian

import (
	"bytes"
	"context"
	"errors"
	"math"
	"testing"
	"time"

	"github.com/grafana/dataplane/sdata/numeric"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	promValue "github.com/prometheus/prometheus/model/value"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	testMetricName = "test_metric_name"
)

type fakeRemoteWriter struct {
	mock.Mock
}

func (f *fakeRemoteWriter) WriteDatasource(ctx context.Context, dsUID string, name string, t time.Time, frames data.Frames, orgID int64, extraLabels map[string]string) error {
	args := f.Called(ctx, dsUID, name, t, frames, orgID, extraLabels)
	return args.Error(0)
}

type panicRemoteWriter struct {
	mock.Mock
	panicMessage string
}

func (p *panicRemoteWriter) WriteDatasource(ctx context.Context, dsUID string, name string, t time.Time, frames data.Frames, orgID int64, extraLabels map[string]string) error {
	p.Called(ctx, dsUID, name, t, frames, orgID, extraLabels)
	panic(p.panicMessage)
}

func TestNewRemotePrometheusBackend(t *testing.T) {
	cfg, err := NewPrometheusConfig(setting.UnifiedAlertingStateHistorySettings{
		PrometheusTargetDatasourceUID: "test-ds-uid",
		PrometheusMetricName:          testMetricName,
	})
	require.NoError(t, err)

	fakeWriter := new(fakeRemoteWriter)
	logger := log.NewNopLogger()
	met := metrics.NewHistorianMetrics(prometheus.NewRegistry(), "test")

	backend := NewRemotePrometheusBackend(cfg, fakeWriter, logger, met)

	require.NotNil(t, backend)
	require.Equal(t, cfg.DatasourceUID, backend.cfg.DatasourceUID)
	require.Equal(t, fakeWriter, backend.promWriter)
	require.Equal(t, logger, backend.logger)
	require.Equal(t, met, backend.metrics)
}

func createExpectedFrame(t *testing.T, ruleUID, ruleName, promState, grafanaState string, instanceLabels data.Labels, value float64) *data.Frame {
	t.Helper()

	labels := instanceLabels.Copy()
	labels[alertRuleUIDLabel] = ruleUID
	labels[alertNameLabel] = ruleName
	labels[alertStateLabel] = promState
	labels[grafanaAlertStateLabel] = grafanaState

	valueField := data.NewField("", labels, []float64{value})

	frame := data.NewFrame(testMetricName, valueField)
	frame.SetMeta(&data.FrameMeta{
		Type:        data.FrameTypeNumericMulti,
		TypeVersion: numeric.MultiFrameVersionLatest,
	})
	return frame
}

func createTransition(from, to eval.State, orgID int64, now time.Time) state.StateTransition {
	return state.StateTransition{
		State:         &state.State{AlertRuleUID: "rule-uid", OrgID: orgID, Labels: data.Labels{"instance": "server1"}, State: to, LastEvaluationTime: now},
		PreviousState: from,
	}
}

func assertFramesEqual(t *testing.T, actualFrames data.Frames, expectedFrames data.Frames) {
	t.Helper()

	require.Len(t, actualFrames, len(expectedFrames))

	for i, expectedFrame := range expectedFrames {
		actualFrame := actualFrames[i]
		require.Equal(t, expectedFrame.Name, actualFrame.Name)
		require.Len(t, actualFrame.Fields, 1)

		expectedField := expectedFrame.Fields[0]
		actualField := actualFrame.Fields[0]

		// Check labels
		require.Equal(t, expectedField.Labels, actualField.Labels)

		// Check values with NaN handling
		expectedValue := expectedField.At(0).(float64)
		actualValue := actualField.At(0).(float64)
		if math.IsNaN(expectedValue) {
			require.True(t, math.IsNaN(actualValue))
		} else {
			require.Equal(t, expectedValue, actualValue)
		}
	}
}

func TestPrometheusBackend_Record(t *testing.T) {
	cfg := PrometheusConfig{DatasourceUID: "test-ds-uid", MetricName: testMetricName}
	logger := log.NewNopLogger()
	ctx := context.Background()
	orgID := int64(1)
	now := time.Now()
	ruleMeta := history_model.RuleMeta{Title: "test rule"}

	testCases := []struct {
		name           string
		ruleMeta       history_model.RuleMeta
		states         []state.StateTransition
		expectedErr    error
		expectedFrames data.Frames
	}{
		{
			name:     "No states",
			ruleMeta: history_model.RuleMeta{Title: "Test Rule No States"},
			states:   []state.StateTransition{},
		},
		{
			name:     "normal state only (no metrics emitted)",
			ruleMeta: ruleMeta,
			states: []state.StateTransition{
				{State: &state.State{AlertRuleUID: "rule-uid-normal", OrgID: orgID, Labels: data.Labels{"label1": "value1"}, State: eval.Normal, LastEvaluationTime: now}},
			},
		},
		{
			name:     "remote writer error",
			ruleMeta: ruleMeta,
			states: []state.StateTransition{
				{State: &state.State{AlertRuleUID: "rule-uid-err", OrgID: orgID, Labels: data.Labels{}, State: eval.Alerting, LastEvaluationTime: now}},
			},
			expectedFrames: data.Frames{
				createExpectedFrame(t, "rule-uid-err", "test rule", "firing", "alerting", data.Labels{}, 1),
			},
			expectedErr: errors.New("remote write failed"),
		},
		{
			name:     "internal labels are skipped",
			ruleMeta: ruleMeta,
			states: []state.StateTransition{
				{
					State: &state.State{
						AlertRuleUID:       "rule-uid-internal",
						OrgID:              orgID,
						Labels:             data.Labels{ngmodels.AutogeneratedRouteLabel: "ignored", "label1": "value1", "__label2": "value2"},
						State:              eval.Alerting,
						LastEvaluationTime: now,
					},
				},
			},
			expectedFrames: data.Frames{
				createExpectedFrame(t, "rule-uid-internal", "test rule", "firing", "alerting", data.Labels{"label1": "value1"}, 1.0),
			},
		},
		{
			name:     "mixed states (normal, pending, recovering, error, nodata)",
			ruleMeta: ruleMeta,
			states: []state.StateTransition{
				{State: &state.State{AlertRuleUID: "rule-uid-normal", OrgID: orgID, Labels: data.Labels{"state": "normal"}, State: eval.Normal, LastEvaluationTime: now}},
				{State: &state.State{AlertRuleUID: "rule-uid-pending", OrgID: orgID, Labels: data.Labels{"state": "pending"}, State: eval.Pending, LastEvaluationTime: now}},
				{State: &state.State{AlertRuleUID: "rule-uid-recovering", OrgID: orgID, Labels: data.Labels{"state": "recovering"}, State: eval.Recovering, LastEvaluationTime: now}},
				{State: &state.State{AlertRuleUID: "rule-uid-error", OrgID: orgID, Labels: data.Labels{"state": "error"}, State: eval.Error, LastEvaluationTime: now}},
				{State: &state.State{AlertRuleUID: "rule-uid-nodata", OrgID: orgID, Labels: data.Labels{"state": "nodata"}, State: eval.NoData, LastEvaluationTime: now}},
			},
			expectedFrames: data.Frames{
				createExpectedFrame(t, "rule-uid-pending", "test rule", "pending", "pending", data.Labels{"state": "pending"}, 1.0),
				createExpectedFrame(t, "rule-uid-recovering", "test rule", "firing", "recovering", data.Labels{"state": "recovering"}, 1.0),
				createExpectedFrame(t, "rule-uid-error", "test rule", "firing", "error", data.Labels{"state": "error"}, 1.0),
				createExpectedFrame(t, "rule-uid-nodata", "test rule", "firing", "nodata", data.Labels{"state": "nodata"}, 1.0),
			},
		},

		// State transitions - Normal to other states (single active frame)
		{
			name:     "normal to alerting transition",
			ruleMeta: ruleMeta,
			states:   []state.StateTransition{createTransition(eval.Normal, eval.Alerting, orgID, now)},
			expectedFrames: data.Frames{
				createExpectedFrame(t, "rule-uid", "test rule", "firing", "alerting", data.Labels{"instance": "server1"}, 1.0),
			},
		},
		{
			name:     "normal to pending transition",
			ruleMeta: ruleMeta,
			states:   []state.StateTransition{createTransition(eval.Normal, eval.Pending, orgID, now)},
			expectedFrames: data.Frames{
				createExpectedFrame(t, "rule-uid", "test rule", "pending", "pending", data.Labels{"instance": "server1"}, 1.0),
			},
		},
		{
			name:     "normal to error transition",
			ruleMeta: ruleMeta,
			states:   []state.StateTransition{createTransition(eval.Normal, eval.Error, orgID, now)},
			expectedFrames: data.Frames{
				createExpectedFrame(t, "rule-uid", "test rule", "firing", "error", data.Labels{"instance": "server1"}, 1.0),
			},
		},

		// Transitions to Normal (StaleNaN only)
		{
			name:     "alerting to normal transition",
			ruleMeta: ruleMeta,
			states:   []state.StateTransition{createTransition(eval.Alerting, eval.Normal, orgID, now)},
			expectedFrames: data.Frames{
				createExpectedFrame(t, "rule-uid", "test rule", "firing", "alerting", data.Labels{"instance": "server1"}, math.Float64frombits(promValue.StaleNaN)),
			},
		},
		{
			name:     "error to normal transition",
			ruleMeta: ruleMeta,
			states:   []state.StateTransition{createTransition(eval.Error, eval.Normal, orgID, now)},
			expectedFrames: data.Frames{
				createExpectedFrame(t, "rule-uid", "test rule", "firing", "error", data.Labels{"instance": "server1"}, math.Float64frombits(promValue.StaleNaN)),
			},
		},
		{
			name:     "pending to alerting transition",
			ruleMeta: ruleMeta,
			states:   []state.StateTransition{createTransition(eval.Pending, eval.Alerting, orgID, now)},
			expectedFrames: data.Frames{
				createExpectedFrame(t, "rule-uid", "test rule", "pending", "pending", data.Labels{"instance": "server1"}, math.Float64frombits(promValue.StaleNaN)),
				createExpectedFrame(t, "rule-uid", "test rule", "firing", "alerting", data.Labels{"instance": "server1"}, 1.0),
			},
		},
		{
			name:     "alerting to recovering transition",
			ruleMeta: ruleMeta,
			states:   []state.StateTransition{createTransition(eval.Alerting, eval.Recovering, orgID, now)},
			expectedFrames: data.Frames{
				createExpectedFrame(t, "rule-uid", "test rule", "firing", "alerting", data.Labels{"instance": "server1"}, math.Float64frombits(promValue.StaleNaN)),
				createExpectedFrame(t, "rule-uid", "test rule", "firing", "recovering", data.Labels{"instance": "server1"}, 1.0),
			},
		},

		// No metric should be written
		{
			name:     "Normal to Normal transition",
			ruleMeta: ruleMeta,
			states:   []state.StateTransition{createTransition(eval.Normal, eval.Normal, orgID, now)},
		},
		{
			name:     "labels with invalid characters are sanitized",
			ruleMeta: ruleMeta,
			states: []state.StateTransition{
				{
					State: &state.State{
						AlertRuleUID:       "rule-uid-sanitize",
						OrgID:              orgID,
						Labels:             data.Labels{"valid-label": "value1", "invalid.label": "value2", "label-with-dash": "value3", "123starts-with-number": "value4", "has spaces": "value5"},
						State:              eval.Alerting,
						LastEvaluationTime: now,
					},
				},
			},
			expectedFrames: data.Frames{
				createExpectedFrame(t, "rule-uid-sanitize", "test rule", "firing", "alerting", data.Labels{"valid_label": "value1", "invalid_label": "value2", "label_with_dash": "value3", "_23starts_with_number": "value4", "has_spaces": "value5"}, 1.0),
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			fakeWriter := new(fakeRemoteWriter)
			met := metrics.NewHistorianMetrics(prometheus.NewRegistry(), "test")
			backend := NewRemotePrometheusBackend(cfg, fakeWriter, logger, met)

			if tc.expectedFrames != nil {
				var extraLabels map[string]string
				fakeWriter.On(
					"WriteDatasource", ctx, cfg.DatasourceUID, testMetricName, now, mock.Anything, orgID, extraLabels,
				).Return(tc.expectedErr).Once().Run(func(args mock.Arguments) {
					if tc.expectedErr == nil {
						actualFrames := args.Get(4).(data.Frames)
						assertFramesEqual(t, actualFrames, tc.expectedFrames)
					}
				})
			}

			errCh := backend.Record(ctx, tc.ruleMeta, tc.states)
			err, ok := <-errCh
			require.True(t, ok)

			if tc.expectedErr == nil {
				require.Nil(t, err)
			} else {
				require.ErrorIs(t, err, tc.expectedErr)
			}

			fakeWriter.AssertExpectations(t)
			if tc.expectedFrames == nil {
				fakeWriter.AssertNotCalled(t, "WriteDatasource", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
			}
		})
	}
}

func TestPrometheusBackend_Query(t *testing.T) {
	cfg := PrometheusConfig{DatasourceUID: "test-ds-uid", MetricName: testMetricName}
	logger := log.NewNopLogger()
	fakeWriter := new(fakeRemoteWriter)
	met := metrics.NewHistorianMetrics(prometheus.NewRegistry(), "test")

	backend := NewRemotePrometheusBackend(cfg, fakeWriter, logger, met)

	frame, err := backend.Query(context.Background(), ngmodels.HistoryQuery{})
	require.Error(t, err)
	require.Nil(t, frame)
	require.Contains(t, err.Error(), "prometheus historian backend does not support querying")
}

func TestPrometheusBackend_Record_Metrics(t *testing.T) {
	cfg := PrometheusConfig{DatasourceUID: "test-ds-uid", MetricName: testMetricName}
	logger := log.NewNopLogger()
	ctx := context.Background()
	orgID := int64(1)
	now := time.Now()
	ruleMeta := history_model.RuleMeta{Title: "test rule"}

	t.Run("success metrics", func(t *testing.T) {
		fakeWriter := new(fakeRemoteWriter)
		fakeWriter.On("WriteDatasource", ctx, cfg.DatasourceUID, testMetricName, now, mock.Anything, orgID, mock.Anything).Return(nil).Once()

		registry := prometheus.NewRegistry()
		met := metrics.NewHistorianMetrics(registry, "test")
		backend := NewRemotePrometheusBackend(cfg, fakeWriter, logger, met)

		states := []state.StateTransition{
			{State: &state.State{AlertRuleUID: "rule-uid", OrgID: orgID, Labels: data.Labels{}, State: eval.Alerting, LastEvaluationTime: now}},
			{State: &state.State{AlertRuleUID: "rule-uid-2", OrgID: orgID, Labels: data.Labels{}, State: eval.Pending, LastEvaluationTime: now}},
			{State: &state.State{AlertRuleUID: "rule-uid-3", OrgID: orgID, Labels: data.Labels{}, State: eval.Normal, LastEvaluationTime: now}},
		}

		errCh := backend.Record(ctx, ruleMeta, states)
		err, ok := <-errCh
		require.True(t, ok)
		require.NoError(t, err)

		// Only 2 frames generated (Alerting + Pending), Normal state doesn't generate frames
		expectedMetrics := `
			# HELP grafana_test_state_history_writes_total The total number of state history batches that were attempted to be written.
			# TYPE grafana_test_state_history_writes_total counter
			grafana_test_state_history_writes_total{backend="prometheus",org="1"} 1
			# HELP grafana_test_state_history_transitions_total The total number of state transitions processed.
			# TYPE grafana_test_state_history_transitions_total counter
			grafana_test_state_history_transitions_total{org="1"} 2
		`

		err = testutil.GatherAndCompare(registry, bytes.NewBufferString(expectedMetrics),
			"grafana_test_state_history_writes_total",
			"grafana_test_state_history_transitions_total")
		require.NoError(t, err)
		fakeWriter.AssertExpectations(t)
	})

	t.Run("failure metrics", func(t *testing.T) {
		fakeWriter := new(fakeRemoteWriter)
		expectedErr := errors.New("write failed")
		fakeWriter.On("WriteDatasource", ctx, cfg.DatasourceUID, testMetricName, now, mock.Anything, orgID, mock.Anything).Return(expectedErr).Once()

		registry := prometheus.NewRegistry()
		met := metrics.NewHistorianMetrics(registry, "test")
		backend := NewRemotePrometheusBackend(cfg, fakeWriter, logger, met)

		states := []state.StateTransition{
			{State: &state.State{AlertRuleUID: "rule-uid", OrgID: orgID, Labels: data.Labels{}, State: eval.Alerting, LastEvaluationTime: now}},
		}

		errCh := backend.Record(ctx, ruleMeta, states)
		err, ok := <-errCh
		require.True(t, ok)
		require.Error(t, err)

		expectedMetrics := `
			# HELP grafana_test_state_history_writes_total The total number of state history batches that were attempted to be written.
			# TYPE grafana_test_state_history_writes_total counter
			grafana_test_state_history_writes_total{backend="prometheus",org="1"} 1
			# HELP grafana_test_state_history_writes_failed_total The total number of failed writes of state history batches.
			# TYPE grafana_test_state_history_writes_failed_total counter
			grafana_test_state_history_writes_failed_total{backend="prometheus",org="1"} 1
			# HELP grafana_test_state_history_transitions_total The total number of state transitions processed.
			# TYPE grafana_test_state_history_transitions_total counter
			grafana_test_state_history_transitions_total{org="1"} 1
			# HELP grafana_test_state_history_transitions_failed_total The total number of state transitions that failed to be written - they are not retried.
			# TYPE grafana_test_state_history_transitions_failed_total counter
			grafana_test_state_history_transitions_failed_total{org="1"} 1
		`

		err = testutil.GatherAndCompare(registry, bytes.NewBufferString(expectedMetrics),
			"grafana_test_state_history_writes_total",
			"grafana_test_state_history_writes_failed_total",
			"grafana_test_state_history_transitions_total",
			"grafana_test_state_history_transitions_failed_total")
		require.NoError(t, err)
		fakeWriter.AssertExpectations(t)
	})
}

func TestPrometheusBackend_Record_PanicRecovery(t *testing.T) {
	cfg := PrometheusConfig{DatasourceUID: "test-ds-uid", MetricName: testMetricName}
	logger := log.NewNopLogger()
	ctx := context.Background()
	orgID := int64(1)
	now := time.Now()
	ruleMeta := history_model.RuleMeta{Title: "test rule"}

	panicMessage := "panic in WriteDatasource"
	panicWriter := &panicRemoteWriter{panicMessage: panicMessage}

	panicWriter.On("WriteDatasource", ctx, cfg.DatasourceUID, testMetricName, now, mock.Anything, orgID, mock.Anything).Once()

	met := metrics.NewHistorianMetrics(prometheus.NewRegistry(), "test")
	backend := NewRemotePrometheusBackend(cfg, panicWriter, logger, met)

	states := []state.StateTransition{
		{State: &state.State{
			AlertRuleUID:       "rule-uid-panic",
			OrgID:              orgID,
			Labels:             data.Labels{"test": "panic"},
			State:              eval.Alerting,
			LastEvaluationTime: now,
		}},
	}

	errCh := backend.Record(ctx, ruleMeta, states)

	err, ok := <-errCh
	require.True(t, ok)
	require.Error(t, err)
	require.ErrorContains(t, err, "prometheus historian panic")
	require.ErrorContains(t, err, panicMessage)

	panicWriter.AssertExpectations(t)
}
