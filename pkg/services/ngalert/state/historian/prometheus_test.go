package historian

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
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
)

type fakeRemoteWriter struct {
	mock.Mock
}

func (f *fakeRemoteWriter) WriteDatasource(ctx context.Context, dsUID string, name string, t time.Time, frames data.Frames, orgID int64, extraLabels map[string]string) error {
	args := f.Called(ctx, dsUID, name, t, frames, orgID, extraLabels)
	return args.Error(0)
}

func TestNewRemotePrometheusBackend(t *testing.T) {
	cfg := PrometheusConfig{DatasourceUID: "test-ds-uid"}
	fakeWriter := new(fakeRemoteWriter)
	logger := log.NewNopLogger()

	backend := NewRemotePrometheusBackend(cfg, fakeWriter, logger)

	require.NotNil(t, backend)
	require.Equal(t, cfg.DatasourceUID, backend.cfg.DatasourceUID)
	require.Equal(t, fakeWriter, backend.promWriter)
	require.Equal(t, logger, backend.logger)
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

func TestPrometheusBackend_Record_Transitions(t *testing.T) {
	cfg := PrometheusConfig{DatasourceUID: "test-ds-uid"}
	logger := log.NewNopLogger()
	ctx := context.Background()
	orgID := int64(1)
	now := time.Now()
	ruleMeta := history_model.RuleMeta{Title: "test rule"}

	t.Run("transitions from Normal or non-metric states that emit single active metric", func(t *testing.T) {
		testCases := []struct {
			from       eval.State
			to         eval.State
			promState  string
			stateValue string
		}{
			// From Normal - single active frame only
			{from: eval.Normal, to: eval.Alerting, promState: "firing", stateValue: "alerting"},
			{from: eval.Normal, to: eval.Pending, promState: "pending", stateValue: "pending"},
			{from: eval.Normal, to: eval.Recovering, promState: "firing", stateValue: "recovering"},

			// From non-metric states - single active frame only
			{from: eval.Error, to: eval.Alerting, promState: "firing", stateValue: "alerting"},
			{from: eval.Error, to: eval.Pending, promState: "pending", stateValue: "pending"},
			{from: eval.Error, to: eval.Recovering, promState: "firing", stateValue: "recovering"},

			{from: eval.NoData, to: eval.Alerting, promState: "firing", stateValue: "alerting"},
			{from: eval.NoData, to: eval.Pending, promState: "pending", stateValue: "pending"},
			{from: eval.NoData, to: eval.Recovering, promState: "firing", stateValue: "recovering"},
		}

		for _, tc := range testCases {
			fromState := tc.from.String()
			toState := tc.to.String()
			t.Run(fromState+" to "+toState, func(t *testing.T) {
				fakeWriter := new(fakeRemoteWriter)
				backend := NewRemotePrometheusBackend(cfg, fakeWriter, logger)

				transition := createTransition(tc.from, tc.to, orgID, now)

				expectedFrames := data.Frames{
					createExpectedFrame(t, "rule-uid", "test rule", tc.promState, tc.stateValue, data.Labels{"instance": "server1"}, 1.0),
				}

				var extraLabels map[string]string
				fakeWriter.On(
					"WriteDatasource", ctx, cfg.DatasourceUID, alertMetricName, now, framesEqual(expectedFrames), orgID, extraLabels,
				).Return(nil).Once()

				errCh := backend.Record(ctx, ruleMeta, []state.StateTransition{transition})
				err, ok := <-errCh
				require.True(t, ok)
				require.Nil(t, err)

				fakeWriter.AssertExpectations(t)
			})
		}
	})

	t.Run("transitions that emit StaleNaN", func(t *testing.T) {
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
				backend := NewRemotePrometheusBackend(cfg, fakeWriter, logger)

				transition := createTransition(tc.from, eval.Normal, orgID, now)

				expectedFrames := data.Frames{
					createExpectedFrame(t, "rule-uid", "test rule", tc.promState, tc.stateValue, data.Labels{"instance": "server1"}, math.Float64frombits(promValue.StaleNaN)),
				}

				var extraLabels map[string]string
				fakeWriter.On(
					"WriteDatasource", ctx, cfg.DatasourceUID, alertMetricName, now, framesEqual(expectedFrames), orgID, extraLabels,
				).Return(nil).Once()

				errCh := backend.Record(ctx, ruleMeta, []state.StateTransition{transition})
				err, ok := <-errCh
				require.True(t, ok)
				require.Nil(t, err)

				fakeWriter.AssertExpectations(t)
			})
		}
	})

	t.Run("transitions between non-Normal states that emit StaleNaN + active metric", func(t *testing.T) {
		testCases := []struct {
			from           eval.State
			to             eval.State
			fromPromState  string
			fromStateValue string
			toPromState    string
			toStateValue   string
		}{
			// Pending to other states
			{from: eval.Pending, to: eval.Alerting, fromPromState: "pending", fromStateValue: "pending", toPromState: "firing", toStateValue: "alerting"},
			{from: eval.Pending, to: eval.Recovering, fromPromState: "pending", fromStateValue: "pending", toPromState: "firing", toStateValue: "recovering"},

			// Alerting to other states
			{from: eval.Alerting, to: eval.Pending, fromPromState: "firing", fromStateValue: "alerting", toPromState: "pending", toStateValue: "pending"},
			{from: eval.Alerting, to: eval.Recovering, fromPromState: "firing", fromStateValue: "alerting", toPromState: "firing", toStateValue: "recovering"},

			// Recovering to other states
			{from: eval.Recovering, to: eval.Pending, fromPromState: "firing", fromStateValue: "recovering", toPromState: "pending", toStateValue: "pending"},
			{from: eval.Recovering, to: eval.Alerting, fromPromState: "firing", fromStateValue: "recovering", toPromState: "firing", toStateValue: "alerting"},
		}

		for _, tc := range testCases {
			fromState := tc.from.String()
			toState := tc.to.String()
			t.Run(fromState+" to "+toState, func(t *testing.T) {
				fakeWriter := new(fakeRemoteWriter)
				backend := NewRemotePrometheusBackend(cfg, fakeWriter, logger)

				transition := createTransition(tc.from, tc.to, orgID, now)

				expectedFrames := data.Frames{
					// StaleNaN for previous state
					createExpectedFrame(t, "rule-uid", "test rule", tc.fromPromState, tc.fromStateValue, data.Labels{"instance": "server1"}, math.Float64frombits(promValue.StaleNaN)),
					// Active metric for new state
					createExpectedFrame(t, "rule-uid", "test rule", tc.toPromState, tc.toStateValue, data.Labels{"instance": "server1"}, 1.0),
				}

				var extraLabels map[string]string
				fakeWriter.On(
					"WriteDatasource", ctx, cfg.DatasourceUID, alertMetricName, now, framesEqual(expectedFrames), orgID, extraLabels,
				).Return(nil).Once()

				errCh := backend.Record(ctx, ruleMeta, []state.StateTransition{transition})
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
				backend := NewRemotePrometheusBackend(cfg, fakeWriter, logger)

				transition := createTransition(tc.from, tc.to, orgID, now)

				errCh := backend.Record(ctx, ruleMeta, []state.StateTransition{transition})
				err, ok := <-errCh
				require.True(t, ok)
				require.Nil(t, err)

				fakeWriter.AssertNotCalled(t, "WriteDatasource", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything)
			})
		}
	})
}

func TestPrometheusBackend_Record(t *testing.T) {
	cfg := PrometheusConfig{DatasourceUID: "test-ds-uid"}
	logger := log.NewNopLogger()
	ctx := context.Background()
	orgID := int64(1)
	now := time.Now()

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
			name:     "Ignored states only (Normal, Error)",
			ruleMeta: history_model.RuleMeta{Title: "test rule"},
			states: []state.StateTransition{
				{State: &state.State{AlertRuleUID: "rule-uid-normal", OrgID: orgID, Labels: data.Labels{"label1": "value1"}, State: eval.Normal, LastEvaluationTime: now}},
				{State: &state.State{AlertRuleUID: "rule-uid-error", OrgID: orgID, Labels: data.Labels{"label2": "value2"}, State: eval.Error, LastEvaluationTime: now}},
			},
		},
		{
			name:     "Single Alerting state",
			ruleMeta: history_model.RuleMeta{Title: "test rule"},
			states: []state.StateTransition{
				{State: &state.State{AlertRuleUID: "rule-uid-alerting", OrgID: orgID, Labels: data.Labels{"instance": "server1"}, State: eval.Alerting, LastEvaluationTime: now}},
			},
			expectedFrames: data.Frames{
				createExpectedFrame(t, "rule-uid-alerting", "test rule", "firing", "alerting", data.Labels{"instance": "server1"}, 1.0),
			},
		},
		{
			name:     "Mixed states (Normal, Pending, Recovering)",
			ruleMeta: history_model.RuleMeta{Title: "test rule"},
			states: []state.StateTransition{
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
			ruleMeta: history_model.RuleMeta{Title: "test rule"},
			states: []state.StateTransition{
				{State: &state.State{AlertRuleUID: "rule-uid-err", OrgID: orgID, Labels: data.Labels{}, State: eval.Alerting, LastEvaluationTime: now}},
			},
			expectedFrames: data.Frames{
				createExpectedFrame(t, "rule-uid-err", "test rule", "firing", "alerting", data.Labels{}, 1),
			},
			expectedErr: errors.New("remote write failed"),
		},
		{
			name:     "Internal labels are skipped",
			ruleMeta: history_model.RuleMeta{Title: "test rule"},
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
				createExpectedFrame(t, "rule-uid-internal", "test rule", "firing", "alerting", data.Labels{"label1": "value1", "__label2": "value2"}, 1.0),
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			fakeWriter := new(fakeRemoteWriter)
			backend := NewRemotePrometheusBackend(cfg, fakeWriter, logger)

			if tc.expectedFrames != nil {
				var extraLabels map[string]string
				fakeWriter.On(
					"WriteDatasource", ctx, cfg.DatasourceUID, alertMetricName, now, framesEqual(tc.expectedFrames), orgID, extraLabels,
				).Return(tc.expectedErr).Once()
			}

			errCh := backend.Record(ctx, tc.ruleMeta, tc.states)
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

func TestPrometheusBackend_Query(t *testing.T) {
	cfg := PrometheusConfig{DatasourceUID: "test-ds-uid"}
	logger := log.NewNopLogger()
	fakeWriter := new(fakeRemoteWriter)

	backend := NewRemotePrometheusBackend(cfg, fakeWriter, logger)

	frame, err := backend.Query(context.Background(), ngmodels.HistoryQuery{})
	require.Error(t, err)
	require.Nil(t, frame)
	require.Contains(t, err.Error(), "prometheus historian backend does not support querying")
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

func TestGetSamples(t *testing.T) {
	testCases := []struct {
		name           string
		from           eval.State
		to             eval.State
		expectedCount  int
		expectedValues []float64
		expectedStates []string
	}{
		{
			name:           "Normal to Alerting - single active sample",
			from:           eval.Normal,
			to:             eval.Alerting,
			expectedCount:  1,
			expectedValues: []float64{1.0},
			expectedStates: []string{"alerting"},
		},
		{
			name:           "Pending to Alerting - StaleNaN + active sample",
			from:           eval.Pending,
			to:             eval.Alerting,
			expectedCount:  2,
			expectedValues: []float64{math.Float64frombits(promValue.StaleNaN), 1.0},
			expectedStates: []string{"pending", "alerting"},
		},
		{
			name:           "Alerting to Recovering - StaleNaN + active sample",
			from:           eval.Alerting,
			to:             eval.Recovering,
			expectedCount:  2,
			expectedValues: []float64{math.Float64frombits(promValue.StaleNaN), 1.0},
			expectedStates: []string{"alerting", "recovering"},
		},
		{
			name:           "Alerting to Normal - single StaleNaN sample",
			from:           eval.Alerting,
			to:             eval.Normal,
			expectedCount:  1,
			expectedValues: []float64{math.Float64frombits(promValue.StaleNaN)},
			expectedStates: []string{"alerting"},
		},
		{
			name:           "Normal to Normal - no samples",
			from:           eval.Normal,
			to:             eval.Normal,
			expectedCount:  0,
			expectedValues: []float64{},
			expectedStates: []string{},
		},
		{
			name:           "Error to Normal - no samples",
			from:           eval.Error,
			to:             eval.Normal,
			expectedCount:  0,
			expectedValues: []float64{},
			expectedStates: []string{},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			now := time.Now()
			transition := createTransition(tc.from, tc.to, 1, now)

			samples, ok := getSamples(transition)

			if tc.expectedCount == 0 {
				require.False(t, ok)
				require.Len(t, samples, 0)
				return
			}

			require.True(t, ok)
			require.Len(t, samples, tc.expectedCount)

			for i, sample := range samples {
				expectedValue := tc.expectedValues[i]
				expectedState := tc.expectedStates[i]

				// Use special comparison for NaN values
				if math.IsNaN(expectedValue) {
					require.True(t, math.IsNaN(sample.value), "expected NaN value")
				} else {
					require.Equal(t, expectedValue, sample.value)
				}

				require.Equal(t, expectedState, sample.grafanaState)

				// Check prometheus state mapping
				expectedPromState := expectedState
				if expectedState == "recovering" || expectedState == "alerting" {
					expectedPromState = "firing"
				}
				require.Equal(t, expectedPromState, sample.promState)
			}
		})
	}
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
