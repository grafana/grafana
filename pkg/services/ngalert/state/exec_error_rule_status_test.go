package state

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// A query failure must be visible in rule health and lastError
// independently of execErrState: execErrState governs only the
// resulting alert state, not whether the failure is reported.
func TestExecErrorState_HealthAndLastError(t *testing.T) {
	queryErr := errors.New("failed to execute query [A]: client: failed to query data: context deadline exceeded")
	t1 := time.Unix(0, 0).UTC()
	t2 := t1.Add(60 * time.Second)
	t3 := t2.Add(60 * time.Second)

	cases := []struct {
		execErrState ngmodels.ExecutionErrorState
		wantState    eval.State
	}{
		{ngmodels.KeepLastErrState, eval.Normal},
		{ngmodels.OkErrState, eval.Normal},
		{ngmodels.AlertingErrState, eval.Alerting},
		{ngmodels.ErrorErrState, eval.Error},
	}

	for _, tc := range cases {
		t.Run(string(tc.execErrState), func(t *testing.T) {
			clk := clock.NewMock()
			cfg := ManagerCfg{
				Metrics:       metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics(),
				Tracer:        tracing.InitializeTracerForTest(),
				Log:           log.New("ngalert.state.manager"),
				ExternalURL:   nil,
				InstanceStore: &FakeInstanceStore{},
				Images:        &NotAvailableImageService{},
				Clock:         clk,
				Historian:     &FakeHistorian{},
			}
			st := NewManager(cfg, NewNoopPersister())

			rule := &ngmodels.AlertRule{
				OrgID: 1,
				Title: "test_title",
				UID:   "test_alert_rule_uid",
				Data: []ngmodels.AlertQuery{{
					RefID:         "A",
					DatasourceUID: "datasource_uid_1",
				}, {
					RefID:         "B",
					DatasourceUID: expr.DatasourceType,
				}},
				NamespaceUID:    "test_namespace_uid",
				IntervalSeconds: 60,
				NoDataState:     ngmodels.NoData,
				ExecErrState:    tc.execErrState,
			}

			evaluate := func(t *testing.T, at time.Time, result eval.Result) {
				t.Helper()
				clk.Set(at)
				_, err := st.ProcessEvalResults(context.Background(), at, rule, eval.Results{result}, data.Labels{}, func(_ context.Context, _ StateTransitions) {})
				require.NoError(t, err)
			}

			evaluate(t, t1, eval.Result{
				Instance:    data.Labels{},
				State:       eval.Normal,
				EvaluatedAt: t1,
			})

			evaluate(t, t2, eval.Result{
				Instance:    data.Labels{},
				State:       eval.Error,
				Error:       queryErr,
				EvaluatedAt: t2,
			})

			states := st.GetStatesForRuleUID(context.Background(), rule.OrgID, rule.UID)
			require.Len(t, states, 1)
			assert.Equal(t, tc.wantState, states[0].State, "execErrState must govern only the alert state")

			status := StatesToRuleStatus(states)
			assert.Equal(t, "error", status.Health, "health must reflect the failed query, not execErrState")
			require.NotNil(t, status.LastError, "lastError must survive execErrState")
			assert.Equal(t, queryErr.Error(), status.LastError.Error())

			// Recovery: once the query succeeds again, the stale error
			// must not keep the rule health at "error".
			evaluate(t, t3, eval.Result{
				Instance:    data.Labels{},
				State:       eval.Normal,
				EvaluatedAt: t3,
			})

			states = st.GetStatesForRuleUID(context.Background(), rule.OrgID, rule.UID)
			require.Len(t, states, 1)
			assert.Equal(t, eval.Normal, states[0].State)
			status = StatesToRuleStatus(states)
			assert.Equal(t, "ok", status.Health)
			assert.Nil(t, status.LastError)
		})
	}
}

// A query failure recorded under KeepLast while the instance is Pending
// must not keep rule health at "error" once a later Alerting evaluation
// succeeds but the instance still stays Pending because For has not
// elapsed (Cursor Bugbot finding on PR #136769).
func TestExecErrorState_PendingHealthAfterRecovery(t *testing.T) {
	queryErr := errors.New("failed to execute query [A]: client: failed to query data: context deadline exceeded")
	t1 := time.Unix(0, 0).UTC()
	t2 := t1.Add(60 * time.Second)
	t3 := t2.Add(60 * time.Second)

	clk := clock.NewMock()
	cfg := ManagerCfg{
		Metrics:       metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics(),
		Tracer:        tracing.InitializeTracerForTest(),
		Log:           log.New("ngalert.state.manager"),
		ExternalURL:   nil,
		InstanceStore: &FakeInstanceStore{},
		Images:        &NotAvailableImageService{},
		Clock:         clk,
		Historian:     &FakeHistorian{},
	}
	st := NewManager(cfg, NewNoopPersister())

	rule := &ngmodels.AlertRule{
		OrgID: 1,
		Title: "test_title",
		UID:   "test_alert_rule_uid",
		Data: []ngmodels.AlertQuery{{
			RefID:         "A",
			DatasourceUID: "datasource_uid_1",
		}, {
			RefID:         "B",
			DatasourceUID: expr.DatasourceType,
		}},
		NamespaceUID:    "test_namespace_uid",
		IntervalSeconds: 60,
		For:             5 * time.Minute,
		NoDataState:     ngmodels.NoData,
		ExecErrState:    ngmodels.KeepLastErrState,
	}

	evaluate := func(t *testing.T, at time.Time, result eval.Result) {
		t.Helper()
		clk.Set(at)
		_, err := st.ProcessEvalResults(context.Background(), at, rule, eval.Results{result}, data.Labels{}, func(_ context.Context, _ StateTransitions) {})
		require.NoError(t, err)
	}

	// Alerting evaluation with For not yet elapsed: Pending.
	evaluate(t, t1, eval.Result{
		Instance:    data.Labels{},
		State:       eval.Alerting,
		EvaluatedAt: t1,
	})
	states := st.GetStatesForRuleUID(context.Background(), rule.OrgID, rule.UID)
	require.Len(t, states, 1)
	assert.Equal(t, eval.Pending, states[0].State)

	// Query failure under KeepLast: state stays Pending, but health
	// must report the failure.
	evaluate(t, t2, eval.Result{
		Instance:    data.Labels{},
		State:       eval.Error,
		Error:       queryErr,
		EvaluatedAt: t2,
	})
	states = st.GetStatesForRuleUID(context.Background(), rule.OrgID, rule.UID)
	require.Len(t, states, 1)
	assert.Equal(t, eval.Pending, states[0].State)
	status := StatesToRuleStatus(states)
	assert.Equal(t, "error", status.Health)
	require.NotNil(t, status.LastError)
	assert.Equal(t, queryErr.Error(), status.LastError.Error())

	// Query recovers, but For still has not elapsed, so the state stays
	// Pending. Health must still return to ok: the previous error must
	// not be retained by the Pending state.
	evaluate(t, t3, eval.Result{
		Instance:    data.Labels{},
		State:       eval.Alerting,
		EvaluatedAt: t3,
	})
	states = st.GetStatesForRuleUID(context.Background(), rule.OrgID, rule.UID)
	require.Len(t, states, 1)
	assert.Equal(t, eval.Pending, states[0].State)
	status = StatesToRuleStatus(states)
	assert.Equal(t, "ok", status.Health)
	assert.Nil(t, status.LastError)
}
