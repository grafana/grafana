package metricwriter

import (
	"context"
	"errors"
	"math"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/dataplane/sdata/numeric"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	promValue "github.com/prometheus/prometheus/model/value"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/state/metricwriter/model"
)

type fakeRemoteWriter struct {
	mock.Mock
}

func (f *fakeRemoteWriter) WriteDatasource(ctx context.Context, dsUID string, name string, t time.Time, frames data.Frames, orgID int64, extraLabels map[string]string) error {
	args := f.Called(ctx, dsUID, name, t, frames, orgID, extraLabels)
	return args.Error(0)
}

func TestNewWriter(t *testing.T) {
	cfg := Config{DatasourceUID: "test-ds-uid"}
	fakeWriter := new(fakeRemoteWriter)
	logger := log.NewNopLogger()

	metricsWriter, err := NewWriter(cfg, fakeWriter, logger)
	require.NoError(t, err)

	require.NotNil(t, metricsWriter)
	require.Equal(t, cfg.DatasourceUID, metricsWriter.cfg.DatasourceUID)
	require.Equal(t, fakeWriter, metricsWriter.promWriter)
	require.Equal(t, logger, metricsWriter.logger)
}

func createExpectedFrame(t *testing.T, ruleUID, ruleName, promState, grafanaState string, instanceLabels data.Labels, value float64) *data.Frame {
	t.Helper()

	labels := instanceLabels.Copy()
	labels[alertRuleUIDLabel] = ruleUID
	labels[alertNameLabel] = ruleName
	labels[alertStateLabel] = promState
	labels[grafanaAlertStateLabel] = grafanaState

	valueField := data.NewField("", labels, []float64{value})

	frame := data.NewFrame(alertMetricName, valueField)
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

func TestTransitions(t *testing.T) {
	cfg := Config{DatasourceUID: "test-ds-uid"}
	logger := log.NewNopLogger()
	ctx := context.Background()
	orgID := int64(1)
	now := time.Now()
	ruleMeta := model.RuleMeta{Title: "test rule"}

	t.Run("transitions that emit 1", func(t *testing.T) {
		testCases := []struct {
			from       eval.State
			to         eval.State
			promState  string
			stateValue string
		}{
			// To alerting
			{from: eval.Normal, to: eval.Alerting, promState: "firing", stateValue: "alerting"},
			{from: eval.Pending, to: eval.Alerting, promState: "firing", stateValue: "alerting"},
			{from: eval.Recovering, to: eval.Alerting, promState: "firing", stateValue: "alerting"},
			{from: eval.Error, to: eval.Alerting, promState: "firing", stateValue: "alerting"},
			{from: eval.NoData, to: eval.Alerting, promState: "firing", stateValue: "alerting"},

			// To pending
			{from: eval.Normal, to: eval.Pending, promState: "pending", stateValue: "pending"},
			{from: eval.Alerting, to: eval.Pending, promState: "pending", stateValue: "pending"},
			{from: eval.Recovering, to: eval.Pending, promState: "pending", stateValue: "pending"},
			{from: eval.Error, to: eval.Pending, promState: "pending", stateValue: "pending"},
			{from: eval.NoData, to: eval.Pending, promState: "pending", stateValue: "pending"},

			// To recovering
			{from: eval.Normal, to: eval.Recovering, promState: "firing", stateValue: "recovering"},
			{from: eval.Alerting, to: eval.Recovering, promState: "firing", stateValue: "recovering"},
			{from: eval.Pending, to: eval.Recovering, promState: "firing", stateValue: "recovering"},
			{from: eval.Error, to: eval.Recovering, promState: "firing", stateValue: "recovering"},
			{from: eval.NoData, to: eval.Recovering, promState: "firing", stateValue: "recovering"},
		}

		for _, tc := range testCases {
			fromState := tc.from.String()
			toState := tc.to.String()
			t.Run(fromState+" to "+toState, func(t *testing.T) {
				fakeWriter := new(fakeRemoteWriter)
				metricsWriter, err := NewWriter(cfg, fakeWriter, logger)
				require.NoError(t, err)

				transition := createTransition(tc.from, tc.to, orgID, now)

				expectedFrames := data.Frames{
					createExpectedFrame(t, "rule-uid", "test rule", tc.promState, tc.stateValue, data.Labels{"instance": "server1"}, 1.0),
				}

				var extraLabels map[string]string
				fakeWriter.On(
					"WriteDatasource", ctx, cfg.DatasourceUID, alertMetricName, now, framesEqual(expectedFrames), orgID, extraLabels,
				).Return(nil).Once()

				errCh := metricsWriter.Write(ctx, ruleMeta, state.StateTransitions{transition})
				err, ok := <-errCh
				require.True(t, ok)
				require.Nil(t, err)

				fakeWriter.AssertExpectations(t)
			})
		}
	})

	t.Run("transitions that emit StaleNan", func(t *testing.T) {
		testCases := []struct {
			from       eval.State
			promState  string
			stateValue string
		}{
			{from: eval.Alerting, promState: "firing", stateValue: "alerting"},
			{from: eval.Pending, promState: "pending", stateValue: "pending"},
			{from: eval.Recovering, promState: "firing", stateValue: "recovering"},
		}

		for _, tc := range testCases {
			fromState := tc.from.String()
			t.Run(fromState+"->Normal", func(t *testing.T) {
				fakeWriter := new(fakeRemoteWriter)
				metricsWriter, err := NewWriter(cfg, fakeWriter, logger)
				require.NoError(t, err)

				transition := createTransition(tc.from, eval.Normal, orgID, now)

				expectedFrames := data.Frames{
					createExpectedFrame(t, "rule-uid", "test rule", tc.promState, tc.stateValue, data.Labels{"instance": "server1"}, math.Float64frombits(promValue.StaleNaN)),
				}

				var extraLabels map[string]string
				fakeWriter.On(
					"WriteDatasource", ctx, cfg.DatasourceUID, alertMetricName, now, framesEqual(expectedFrames), orgID, extraLabels,
				).Return(nil).Once()

				errCh := metricsWriter.Write(ctx, ruleMeta, state.StateTransitions{transition})
				err, ok := <-errCh
				require.True(t, ok)
				require.Nil(t, err)

				fakeWriter.AssertExpectations(t)
			})
		}
	})

	t.Run("transitions that do not emit anything", func(t *testing.T) {
		testCases := []struct {
			from eval.State
			to   eval.State
		}{
			{from: eval.Normal, to: eval.Error},
			{from: eval.Normal, to: eval.NoData},
			{from: eval.Normal, to: eval.Normal},
			{from: eval.Error, to: eval.Normal},
			{from: eval.Error, to: eval.NoData},
			{from: eval.Error, to: eval.Error},
			{from: eval.NoData, to: eval.Normal},
			{from: eval.NoData, to: eval.Error},
			{from: eval.NoData, to: eval.NoData},
		}

		for _, tc := range testCases {
			fromState := tc.from.String()
			toState := tc.to.String()
			t.Run(fromState+" to "+toState, func(t *testing.T) {
				fakeWriter := new(fakeRemoteWriter)
				metricsWriter, err := NewWriter(cfg, fakeWriter, logger)
				require.NoError(t, err)

				transition := createTransition(tc.from, tc.to, orgID, now)

				errCh := metricsWriter.Write(ctx, ruleMeta, state.StateTransitions{transition})
				err, ok := <-errCh
				require.True(t, ok)
				require.Nil(t, err)

				fakeWriter.AssertNotCalled(t, "WriteDatasource", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
			})
		}
	})
}

func TestAlertStateMetricsWriter_Write(t *testing.T) {
	cfg := Config{DatasourceUID: "test-ds-uid"}
	logger := log.NewNopLogger()
	ctx := context.Background()
	orgID := int64(1)
	now := time.Now()

	testCases := []struct {
		name           string
		ruleMeta       model.RuleMeta
		states         state.StateTransitions
		expectedErr    error
		expectedFrames data.Frames
	}{
		{
			name:     "No states",
			ruleMeta: model.RuleMeta{Title: "Test Rule No States"},
			states:   state.StateTransitions{},
		},
		{
			name:     "Ignored states only (Normal, Error)",
			ruleMeta: model.RuleMeta{Title: "test rule"},
			states: state.StateTransitions{
				{State: &state.State{AlertRuleUID: "rule-uid-normal", OrgID: orgID, Labels: data.Labels{"label1": "value1"}, State: eval.Normal, LastEvaluationTime: now}},
				{State: &state.State{AlertRuleUID: "rule-uid-error", OrgID: orgID, Labels: data.Labels{"label2": "value2"}, State: eval.Error, LastEvaluationTime: now}},
			},
		},
		{
			name:     "Single Alerting state",
			ruleMeta: model.RuleMeta{Title: "test rule"},
			states: state.StateTransitions{
				{State: &state.State{AlertRuleUID: "rule-uid-alerting", OrgID: orgID, Labels: data.Labels{"instance": "server1"}, State: eval.Alerting, LastEvaluationTime: now}},
			},
			expectedFrames: data.Frames{
				createExpectedFrame(t, "rule-uid-alerting", "test rule", "firing", "alerting", data.Labels{"instance": "server1"}, 1.0),
			},
		},
		{
			name:     "Mixed states (Normal, Pending, Recovering)",
			ruleMeta: model.RuleMeta{Title: "test rule"},
			states: state.StateTransitions{
				{State: &state.State{AlertRuleUID: "rule-uid-normal", OrgID: orgID, Labels: data.Labels{"state": "normal"}, State: eval.Normal, LastEvaluationTime: now}},
				{State: &state.State{AlertRuleUID: "rule-uid-pending", OrgID: orgID, Labels: data.Labels{"state": "pending"}, State: eval.Pending, LastEvaluationTime: now}},
				{State: &state.State{AlertRuleUID: "rule-uid-recovering", OrgID: orgID, Labels: data.Labels{"state": "recovering"}, State: eval.Recovering, LastEvaluationTime: now}},
			},
			expectedFrames: data.Frames{
				createExpectedFrame(t, "rule-uid-pending", "test rule", "pending", "pending", data.Labels{"state": "pending"}, 1.0),
				createExpectedFrame(t, "rule-uid-recovering", "test rule", "firing", "recovering", data.Labels{"state": "recovering"}, 1.0),
			},
		},
		{
			name:     "Remote writer error",
			ruleMeta: model.RuleMeta{Title: "test rule"},
			states: state.StateTransitions{
				{State: &state.State{AlertRuleUID: "rule-uid-err", OrgID: orgID, Labels: data.Labels{}, State: eval.Alerting, LastEvaluationTime: now}},
			},
			expectedFrames: data.Frames{
				createExpectedFrame(t, "rule-uid-err", "test rule", "firing", "alerting", data.Labels{}, 1),
			},
			expectedErr: errors.New("remote write failed"),
		},
		{
			name:     "Internal labels are skipped",
			ruleMeta: model.RuleMeta{Title: "test rule"},
			states: state.StateTransitions{
				{
					State: &state.State{
						AlertRuleUID:       "rule-uid-internal",
						OrgID:              orgID,
						Labels:             data.Labels{models.AutogeneratedRouteLabel: "ignored", "label1": "value1", "__label2": "value2"},
						State:              eval.Alerting,
						LastEvaluationTime: now,
					},
				},
			},
			expectedFrames: data.Frames{
				createExpectedFrame(t, "rule-uid-internal", "test rule", "firing", "alerting", data.Labels{"label1": "value1", "__label2": "value2"}, 1.0),
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			fakeWriter := new(fakeRemoteWriter)
			metricsWriter, err := NewWriter(cfg, fakeWriter, logger)
			require.NoError(t, err)

			if tc.expectedFrames != nil {
				var extraLabels map[string]string
				fakeWriter.On(
					"WriteDatasource", ctx, cfg.DatasourceUID, alertMetricName, now, framesEqual(tc.expectedFrames), orgID, extraLabels,
				).Return(tc.expectedErr).Once()
			}

			errCh := metricsWriter.Write(ctx, tc.ruleMeta, tc.states)
			err, ok := <-errCh
			require.True(t, ok)

			if tc.expectedErr != nil {
				require.ErrorIs(t, err, tc.expectedErr)
			} else {
				require.Nil(t, err)
			}

			fakeWriter.AssertExpectations(t)
			if tc.expectedFrames == nil {
				fakeWriter.AssertNotCalled(t, "WriteDatasource", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
			}
		})
	}
}

// Custom comparer that treats NaN values as equal
func frameCmp(a, b *data.Frame) bool {
	opts := []cmp.Option{
		cmp.Comparer(func(x, y float64) bool {
			if math.IsNaN(x) && math.IsNaN(y) {
				return true
			}
			return x == y
		}),
		cmp.AllowUnexported(data.Frame{}, data.Field{}),
	}
	return cmp.Equal(a, b, opts...)
}

func framesEqual(want data.Frames) interface{} {
	return mock.MatchedBy(func(got data.Frames) bool {
		if len(got) != len(want) {
			return false
		}
		for i := range got {
			if !frameCmp(got[i], want[i]) {
				return false
			}
		}
		return true
	})
}
