package state

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestPendingErrorClearedOnNoDataKeepLast(t *testing.T) {
	for _, initial := range []eval.State{eval.Normal, eval.Pending, eval.Alerting} {
		for _, mode := range []ngmodels.ExecutionErrorState{ngmodels.AlertingErrState, ngmodels.ErrorErrState} {
			t.Run(fmt.Sprintf("%s/%s", initial, mode), func(t *testing.T) {
				ctx := context.Background()
				clk := clock.NewMock()
				manager := NewManager(ManagerCfg{
					Metrics: metrics.NewNGAlert(prometheus.NewPedanticRegistry()).GetStateMetrics(),
					Tracer:  tracing.InitializeTracerForTest(), Log: log.New("pending-no-data-health"),
					InstanceStore: &FakeInstanceStore{}, Images: &NotAvailableImageService{}, Clock: clk, Historian: &FakeHistorian{},
				}, NewNoopPersister())
				rule := &ngmodels.AlertRule{OrgID: 1, UID: "pending-rule", Title: "pending", NamespaceUID: "pending-folder", IntervalSeconds: 60,
					NoDataState: ngmodels.KeepLast, ExecErrState: mode, For: 5 * time.Minute, KeepFiringFor: 5 * time.Minute}
				at := time.Unix(10000, 0).UTC()
				evaluate := func(state eval.State, err error) {
					clk.Set(at)
					_, processErr := manager.ProcessEvalResults(ctx, at, rule, eval.Results{{Instance: data.Labels{}, State: state, Error: err, EvaluatedAt: at}}, data.Labels{}, func(context.Context, StateTransitions) {})
					require.NoError(t, processErr)
					at = at.Add(time.Minute)
				}
				switch initial {
				case eval.Normal:
					evaluate(eval.Normal, nil)
				case eval.Pending:
					evaluate(eval.Alerting, nil)
				case eval.Alerting:
					rule.For = 0
					evaluate(eval.Alerting, nil)
					rule.For = 5 * time.Minute
				}
				states := manager.GetStatesForRuleUID(ctx, rule.OrgID, rule.UID)
				require.Len(t, states, 1)
				require.Equal(t, initial, states[0].State)

				assertHealth := func(expectedError bool, expectedText string) {
					t.Helper()
					states := manager.GetStatesForRuleUID(ctx, rule.OrgID, rule.UID)
					require.Len(t, states, 1)
					check := func(status ngmodels.RuleStatus) {
						t.Helper()
						if expectedError {
							require.Equal(t, "error", status.Health)
							require.EqualError(t, status.LastError, expectedText)
						} else {
							require.Equal(t, "ok", status.Health)
							require.Nil(t, status.LastError)
						}
					}
					check(StatesToRuleStatus(states))
					store := &FakeInstanceStore{}
					persister := &SyncStatePersister{log: log.New("persist-review"), store: store, maxStateSaveConcurrency: 1}
					persister.saveAlertStates(ctx, StateTransition{State: states[0]})
					ops := store.RecordedOps()
					require.Len(t, ops, 1)
					persisted, ok := ops[0].(ngmodels.AlertInstance)
					require.True(t, ok)
					restored := AlertInstanceToState(&persisted, log.New("restore-review"))
					require.Equal(t, states[0].State, restored.State)
					check(StatesToRuleStatus([]*State{restored}))
				}
				evaluate(eval.Error, errors.New("query A failed"))
				assertHealth(true, "query A failed")
				evaluate(eval.Error, errors.New("query B failed"))
				assertHealth(true, "query B failed")
				before := manager.GetStatesForRuleUID(ctx, rule.OrgID, rule.UID)[0].Copy()
				evaluate(eval.NoData, nil)
				assertHealth(false, "")
				after := manager.GetStatesForRuleUID(ctx, rule.OrgID, rule.UID)[0]
				require.Equal(t, before.State, after.State)
				if before.State == eval.Pending {
					require.Equal(t, before.StartsAt, after.StartsAt)
					require.Equal(t, before.EndsAt, after.EndsAt)
				}
			})
		}
	}
}
