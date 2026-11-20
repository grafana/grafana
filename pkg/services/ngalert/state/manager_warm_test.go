package state_test

import (
	"context"
	"errors"
	"testing"
	"testing/synctest"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

type warmRuleReader struct {
	rule *models.AlertRule
}

func (r warmRuleReader) ListAlertRules(context.Context, *models.ListAlertRulesQuery) (models.RulesGroup, error) {
	return models.RulesGroup{r.rule}, nil
}

type warmInstanceReader func() []*models.AlertInstance

func (r warmInstanceReader) ListAlertInstances(context.Context, *models.ListAlertInstancesQuery) ([]*models.AlertInstance, error) {
	return r(), nil
}

func TestManager_Warm_preserves_evaluation_completed_during_snapshot_read(t *testing.T) {
	for _, tc := range []struct {
		name           string
		snapshotOffset time.Duration
		missing        bool
	}{
		{name: "older snapshot", snapshotOffset: -time.Minute},
		{name: "equal snapshot"},
		{name: "newer snapshot", snapshotOffset: time.Minute},
		{name: "maintained missing series", snapshotOffset: -time.Minute, missing: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctx := context.Background()
				mgr := state.NewManager(state.ManagerCfg{
					Clock: clock.New(), Log: log.NewNopLogger(), Tracer: tracing.NewNoopTracerService(),
					Images: &state.NoopImageService{},
				}, state.NewNoopPersister())
				rule := &models.AlertRule{OrgID: 1, UID: "rule", IntervalSeconds: 60}
				labels := data.Labels{"series": "one"}
				snapshotTime := time.Now().UTC().Add(tc.snapshotOffset)
				evaluationTime := time.Now().UTC()
				snapshot := &models.AlertInstance{
					AlertInstanceKey: models.AlertInstanceKey{RuleOrgID: rule.OrgID, RuleUID: rule.UID},
					Labels:           models.InstanceLabels(labels),
					CurrentState:     models.InstanceStateNormal,
					LastEvalTime:     snapshotTime,
				}
				result := eval.Result{Instance: labels, State: eval.Alerting, EvaluatedAt: evaluationTime}
				if tc.missing {
					initial := state.AlertInstanceToState(snapshot, log.NewNopLogger())
					initial.State = eval.Alerting
					initial.FiredAt = &snapshotTime
					mgr.Put([]*state.State{initial})
					result.Instance = data.Labels{"series": "other"}
					result.State = eval.Normal
				}
				read := make(chan struct{})
				release := make(chan struct{})
				done := make(chan struct{})
				go func() {
					defer close(done)
					mgr.Warm(ctx, fakeOrgReader{orgs: []int64{rule.OrgID}}, warmRuleReader{rule}, warmInstanceReader(func() []*models.AlertInstance {
						close(read)
						<-release
						return []*models.AlertInstance{snapshot}
					}))
				}()
				<-read
				_, err := mgr.ProcessEvalResults(ctx, evaluationTime, rule, eval.Results{result}, nil, state.NoopSender)
				expected := *mgr.Get(rule.OrgID, rule.UID, labels.Fingerprint())
				close(release)
				<-done

				require.NoError(t, err)
				actual := mgr.Get(rule.OrgID, rule.UID, labels.Fingerprint())
				require.NotNil(t, actual)
				assert.Equal(t, eval.Alerting, actual.State)
				assert.Equal(t, &expected, actual)
				assert.Equal(t, &evaluationTime, actual.LastSentAt)
				if tc.missing {
					assert.Equal(t, snapshotTime, actual.LastEvaluationTime)
					assert.Equal(t, evaluationTime.Add(4*time.Minute), actual.EndsAt)
				} else {
					assert.Equal(t, evaluationTime, actual.LastEvaluationTime)
					assert.Equal(t, &evaluationTime, actual.FiredAt)
				}
				assert.Equal(t, evaluationTime, mgr.GetStatusForRuleUID(ctx, rule.OrgID, rule.UID).EvaluationTimestamp)
			})
		})
	}
}

type warmCaptureFunc func()

func (f warmCaptureFunc) NewImage(context.Context, *models.AlertRule) (*models.Image, error) {
	f()
	return nil, nil
}

func TestManager_Warm_skips_rule_once_evaluation_starts(t *testing.T) {
	for _, tc := range []struct {
		name    string
		result  eval.State
		missing bool
	}{
		{name: "individual transition", result: eval.Alerting},
		{name: "bulk no data transition", result: eval.NoData},
		{name: "bulk error transition", result: eval.Error},
		{name: "missing series resolution", missing: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				ctx := context.Background()
				capturing := make(chan struct{})
				release := make(chan struct{})
				mgr := state.NewManager(state.ManagerCfg{
					Clock: clock.New(), Log: log.NewNopLogger(), Tracer: tracing.NewNoopTracerService(),
					Images: warmCaptureFunc(func() {
						close(capturing)
						<-release
					}),
				}, state.NewNoopPersister())
				rule := &models.AlertRule{
					OrgID: 1, UID: "rule", IntervalSeconds: 60,
					NoDataState: models.Alerting, ExecErrState: models.AlertingErrState,
				}
				labels := data.Labels{"series": "one"}
				evaluationTime := time.Now().UTC()
				initial := &state.State{
					OrgID: rule.OrgID, AlertRuleUID: rule.UID, CacheID: labels.Fingerprint(),
					Labels: labels, State: eval.Normal, Annotations: map[string]string{},
					LastEvaluationTime: evaluationTime.Add(-2 * time.Minute),
				}
				result := eval.Result{Instance: labels, State: tc.result, EvaluatedAt: evaluationTime}
				if tc.result == eval.Error {
					result.Error = errors.New("query failed")
				}
				if tc.missing {
					initial.State = eval.Alerting
					result.Instance = data.Labels{"series": "other"}
					result.State = eval.Normal
				}
				mgr.Put([]*state.State{initial})
				evaluated := make(chan error, 1)
				go func() {
					_, err := mgr.ProcessEvalResults(ctx, evaluationTime, rule, eval.Results{result}, nil, state.NoopSender)
					evaluated <- err
				}()
				<-capturing
				snapshot := &models.AlertInstance{
					AlertInstanceKey: models.AlertInstanceKey{RuleOrgID: rule.OrgID, RuleUID: rule.UID},
					Labels:           models.InstanceLabels(labels),
					CurrentState:     models.InstanceStateNormal,
					LastEvalTime:     evaluationTime.Add(time.Minute),
				}
				unseen := *snapshot
				unseen.Labels = models.InstanceLabels{"series": "unseen"}
				restore := func() {
					mgr.Warm(ctx, fakeOrgReader{orgs: []int64{rule.OrgID}}, warmRuleReader{rule}, warmInstanceReader(func() []*models.AlertInstance {
						return []*models.AlertInstance{snapshot, &unseen}
					}))
				}
				// Warm must finish while evaluation is paused, without replacing or adding instances.
				restore()
				during := mgr.Get(rule.OrgID, rule.UID, labels.Fingerprint())
				missingDuring := mgr.Get(rule.OrgID, rule.UID, unseen.Labels.Fingerprint())
				close(release)
				err := <-evaluated
				require.NoError(t, err)
				assert.Same(t, initial, during)
				assert.Nil(t, missingDuring)
				// Bulk replacement and missing-series deletion must not re-enable restore.
				restore()
				assert.Nil(t, mgr.Get(rule.OrgID, rule.UID, unseen.Labels.Fingerprint()))
				actual := mgr.Get(rule.OrgID, rule.UID, labels.Fingerprint())
				if tc.missing {
					assert.Nil(t, actual)
				} else {
					require.NotNil(t, actual)
					assert.Equal(t, eval.Alerting, actual.State)
					assert.Equal(t, evaluationTime, actual.LastEvaluationTime)
					assert.Equal(t, &evaluationTime, actual.LastSentAt)
				}
			})
		})
	}
}

func TestManager_Warm_restores_other_rules(t *testing.T) {
	for _, rule := range []*models.AlertRule{
		{OrgID: 1, UID: "other-rule"},
		{OrgID: 2, UID: "rule"},
	} {
		t.Run(rule.GetKey().String(), func(t *testing.T) {
			ctx := context.Background()
			mgr := state.NewManager(state.ManagerCfg{
				Clock: clock.New(), Log: log.NewNopLogger(), Tracer: tracing.NewNoopTracerService(),
				Images: &state.NoopImageService{},
			}, state.NewNoopPersister())
			now := time.Unix(1000, 0).UTC()
			labels := data.Labels{"series": "one"}
			_, err := mgr.ProcessEvalResults(ctx, now, &models.AlertRule{OrgID: 1, UID: "rule", IntervalSeconds: 60}, eval.Results{{
				Instance: labels, State: eval.Normal, EvaluatedAt: now,
			}}, nil, nil)
			require.NoError(t, err)
			snapshot := &models.AlertInstance{
				AlertInstanceKey: models.AlertInstanceKey{RuleOrgID: rule.OrgID, RuleUID: rule.UID},
				Labels:           models.InstanceLabels(labels),
				CurrentState:     models.InstanceStateNormal,
				LastEvalTime:     now,
			}
			restore := func() {
				mgr.Warm(ctx, fakeOrgReader{orgs: []int64{rule.OrgID}}, warmRuleReader{rule}, warmInstanceReader(func() []*models.AlertInstance {
					return []*models.AlertInstance{snapshot}
				}))
			}
			restore()
			actual := mgr.Get(rule.OrgID, rule.UID, labels.Fingerprint())
			require.NotNil(t, actual)
			assert.Equal(t, now, actual.LastEvaluationTime)

			// A newer snapshot can still replace restored state before this rule evaluates.
			snapshot.LastEvalTime = now.Add(time.Minute)
			snapshot.CurrentState = models.InstanceStatePending
			restore()
			actual = mgr.Get(rule.OrgID, rule.UID, labels.Fingerprint())
			require.NotNil(t, actual)
			assert.Equal(t, eval.Pending, actual.State)
			assert.Equal(t, snapshot.LastEvalTime, actual.LastEvaluationTime)
		})
	}
}

func TestManager_Warm_restores_after_cache_removal(t *testing.T) {
	for _, tc := range []struct {
		name   string
		remove func(*state.Manager, *models.AlertRule)
	}{
		{name: "clear cache", remove: func(m *state.Manager, _ *models.AlertRule) { m.ClearCache() }},
		{name: "forget rule", remove: func(m *state.Manager, r *models.AlertRule) {
			m.ForgetStateByRuleUID(context.Background(), r.GetKeyWithGroup())
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			mgr := state.NewManager(state.ManagerCfg{
				Clock: clock.New(), Log: log.NewNopLogger(), Tracer: tracing.NewNoopTracerService(),
				Images: &state.NoopImageService{},
			}, state.NewNoopPersister())
			now := time.Unix(1000, 0).UTC()
			rule := &models.AlertRule{OrgID: 1, UID: "rule", IntervalSeconds: 60}
			labels := data.Labels{"series": "one"}
			_, err := mgr.ProcessEvalResults(ctx, now, rule, eval.Results{{
				Instance: labels, State: eval.Normal, EvaluatedAt: now,
			}}, nil, nil)
			require.NoError(t, err)
			tc.remove(mgr, rule)
			snapshot := &models.AlertInstance{
				AlertInstanceKey: models.AlertInstanceKey{RuleOrgID: rule.OrgID, RuleUID: rule.UID},
				Labels:           models.InstanceLabels(labels),
				CurrentState:     models.InstanceStatePending,
				LastEvalTime:     now.Add(-time.Minute),
			}
			mgr.Warm(ctx, fakeOrgReader{orgs: []int64{rule.OrgID}}, warmRuleReader{rule}, warmInstanceReader(func() []*models.AlertInstance {
				return []*models.AlertInstance{snapshot}
			}))
			actual := mgr.Get(rule.OrgID, rule.UID, labels.Fingerprint())
			require.NotNil(t, actual)
			assert.Equal(t, eval.Pending, actual.State)
			assert.Equal(t, snapshot.LastEvalTime, actual.LastEvaluationTime)
		})
	}
}
