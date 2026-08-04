package status

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

func TestToAlertRuleStatus(t *testing.T) {
	evalTime := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	withEval := func(s *state.State) *state.State {
		s.LastEvaluationTime = evalTime
		s.EvaluationDuration = 250 * time.Millisecond
		return s
	}

	tests := []struct {
		name       string
		states     []*state.State
		paused     bool
		wantState  model.AlertRuleAlertRuleState
		wantReason model.AlertRuleAlertRuleStateReason
		wantHealth model.AlertRuleAlertRuleHealth
		wantError  string
		wantEval   bool
	}{
		{
			name:       "firing",
			states:     []*state.State{withEval(&state.State{State: eval.Alerting})},
			wantState:  model.AlertRuleAlertRuleStateFiring,
			wantReason: model.AlertRuleAlertRuleStateReasonEvaluated,
			wantHealth: model.AlertRuleAlertRuleHealthOK,
			wantEval:   true,
		},
		{
			name:       "pending",
			states:     []*state.State{withEval(&state.State{State: eval.Pending})},
			wantState:  model.AlertRuleAlertRuleStatePending,
			wantReason: model.AlertRuleAlertRuleStateReasonEvaluated,
			wantHealth: model.AlertRuleAlertRuleHealthOK,
			wantEval:   true,
		},
		{
			name:       "normal is healthy",
			states:     []*state.State{withEval(&state.State{State: eval.Normal})},
			wantState:  model.AlertRuleAlertRuleStateHealthy,
			wantReason: model.AlertRuleAlertRuleStateReasonEvaluated,
			wantHealth: model.AlertRuleAlertRuleHealthOK,
			wantEval:   true,
		},
		{
			name:       "error keeps healthy state with error health",
			states:     []*state.State{withEval(&state.State{State: eval.Error, Error: errors.New("boom")})},
			wantState:  model.AlertRuleAlertRuleStateHealthy,
			wantReason: model.AlertRuleAlertRuleStateReasonEvaluated,
			wantHealth: model.AlertRuleAlertRuleHealthError,
			wantError:  "boom",
			wantEval:   true,
		},
		{
			name:       "nodata keeps healthy state with nodata health",
			states:     []*state.State{withEval(&state.State{State: eval.NoData})},
			wantState:  model.AlertRuleAlertRuleStateHealthy,
			wantReason: model.AlertRuleAlertRuleStateReasonEvaluated,
			wantHealth: model.AlertRuleAlertRuleHealthNoData,
			wantEval:   true,
		},
		{
			name:       "keep-last reason (comma-joined) maps to KeepLast",
			states:     []*state.State{withEval(&state.State{State: eval.Alerting, StateReason: ngmodels.ConcatReasons(ngmodels.StateReasonNoData, ngmodels.StateReasonKeepLast)})},
			wantState:  model.AlertRuleAlertRuleStateFiring,
			wantReason: model.AlertRuleAlertRuleStateReasonKeepLast,
			wantHealth: model.AlertRuleAlertRuleHealthOK,
			wantEval:   true,
		},
		{
			name:       "paused overrides health",
			states:     []*state.State{withEval(&state.State{State: eval.Normal})},
			paused:     true,
			wantState:  model.AlertRuleAlertRuleStateInactive,
			wantReason: model.AlertRuleAlertRuleStateReasonEvaluated,
			wantHealth: model.AlertRuleAlertRuleHealthPaused,
			wantEval:   true,
		},
		{
			name:       "no states is inactive/not-scheduled",
			states:     nil,
			wantState:  model.AlertRuleAlertRuleStateInactive,
			wantReason: model.AlertRuleAlertRuleStateReasonEvaluated,
			wantHealth: model.AlertRuleAlertRuleHealthNotScheduled,
			wantEval:   false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := toAlertRuleStatus(tc.states, tc.paused)

			require.Equal(t, tc.wantState, *got.State)
			require.Equal(t, tc.wantReason, *got.StateReason)
			require.Equal(t, tc.wantHealth, *got.Health)

			if tc.wantError != "" {
				require.NotNil(t, got.LastError)
				require.Equal(t, tc.wantError, *got.LastError)
			} else {
				require.Nil(t, got.LastError)
			}

			if tc.wantEval {
				require.NotNil(t, got.LastEvaluationTime)
				require.True(t, got.LastEvaluationTime.Equal(evalTime))
				require.NotNil(t, got.EvaluationDuration)
				require.InDelta(t, 0.25, *got.EvaluationDuration, 0.001)
			} else {
				require.Nil(t, got.LastEvaluationTime)
				require.Nil(t, got.EvaluationDuration)
			}

			// Blob must round-trip through the JSON shape the read path unmarshals.
			data, err := json.Marshal(got)
			require.NoError(t, err)
			var back model.AlertRuleStatus
			require.NoError(t, json.Unmarshal(data, &back))
			require.Equal(t, got, back)
		})
	}
}

func TestToRecordingRuleStatus(t *testing.T) {
	evalTime := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)

	tests := []struct {
		name       string
		rs         ngmodels.RuleStatus
		found      bool
		paused     bool
		wantHealth model.RecordingRuleRecordingRuleHealth
		wantError  string
	}{
		{
			name:       "ok maps to recording",
			rs:         ngmodels.RuleStatus{Health: "ok", EvaluationTimestamp: evalTime, EvaluationDuration: 100 * time.Millisecond},
			found:      true,
			wantHealth: model.RecordingRuleRecordingRuleHealthRecording,
		},
		{
			name:       "error with lastError",
			rs:         ngmodels.RuleStatus{Health: "error", LastError: errors.New("boom"), EvaluationTimestamp: evalTime},
			found:      true,
			wantHealth: model.RecordingRuleRecordingRuleHealthError,
			wantError:  "boom",
		},
		{
			name:       "not found maps to not scheduled",
			rs:         ngmodels.RuleStatus{},
			found:      false,
			wantHealth: model.RecordingRuleRecordingRuleHealthNotScheduled,
		},
		{
			name:       "paused overrides",
			rs:         ngmodels.RuleStatus{Health: "ok"},
			found:      true,
			paused:     true,
			wantHealth: model.RecordingRuleRecordingRuleHealthPaused,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := toRecordingRuleStatus(tc.rs, tc.found, tc.paused)
			require.Equal(t, tc.wantHealth, *got.Health)
			if tc.wantError != "" {
				require.NotNil(t, got.LastError)
				require.Equal(t, tc.wantError, *got.LastError)
			} else {
				require.Nil(t, got.LastError)
			}

			data, err := json.Marshal(got)
			require.NoError(t, err)
			var back model.RecordingRuleStatus
			require.NoError(t, json.Unmarshal(data, &back))
			require.Equal(t, got, back)
		})
	}
}
