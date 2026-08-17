package state

// LOGZ.IO GRAFANA CHANGE :: APPZ-3028 Targeted state cache warm

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// fakeWarmInstanceStore returns preset instances and records queries and delete calls.
type fakeWarmInstanceStore struct {
	orgIds    []int64
	instances []*ngModels.AlertInstance
	err       error
	queries   []ngModels.ListAlertInstancesQuery
	deletes   int
}

func (f *fakeWarmInstanceStore) FetchOrgIds(_ context.Context) ([]int64, error) {
	return f.orgIds, nil
}

func (f *fakeWarmInstanceStore) ListAlertInstances(_ context.Context, q *ngModels.ListAlertInstancesQuery) ([]*ngModels.AlertInstance, error) {
	f.queries = append(f.queries, *q)
	if f.err != nil {
		return nil, f.err
	}
	return f.instances, nil
}

func (f *fakeWarmInstanceStore) SaveAlertInstance(_ context.Context, _ ngModels.AlertInstance) error {
	return nil
}

func (f *fakeWarmInstanceStore) DeleteAlertInstances(_ context.Context, _ ...ngModels.AlertInstanceKey) error {
	f.deletes++
	return nil
}

func (f *fakeWarmInstanceStore) DeleteAlertInstancesByRule(_ context.Context, _ ngModels.AlertRuleKey) error {
	f.deletes++
	return nil
}

func (f *fakeWarmInstanceStore) FullSync(_ context.Context, _ []ngModels.AlertInstance) error {
	return nil
}

func newTargetedWarmManager(store InstanceStore) (*Manager, *clock.Mock) {
	return newWarmManagerWithFlags(store, true, true)
}

func newWarmManagerWithFlags(store InstanceStore, targetedWarm, shadowCompare bool) (*Manager, *clock.Mock) {
	mockClock := clock.NewMock()
	// Move off the epoch: zero unix-nanoseconds is the never-warmed sentinel of the observer.
	mockClock.Add(time.Hour)
	st := NewManager(ManagerCfg{
		Clock:                     mockClock,
		Log:                       log.New("ngalert.state.manager.test"),
		InstanceStore:             store,
		TargetedWarmEnabled:       targetedWarm,
		TargetedWarmShadowCompare: shadowCompare,
	}, NewNoopPersister())
	return st, mockClock
}

func newWarmRule() *ngModels.AlertRule {
	return ngModels.AlertRuleGen(func(r *ngModels.AlertRule) {
		r.Annotations = map[string]string{"summary": "test summary"}
	})()
}

func mkWarmInstance(rule *ngModels.AlertRule, labels ngModels.InstanceLabels, currentState ngModels.InstanceStateType) *ngModels.AlertInstance {
	return ngModels.AlertInstanceGen(func(i *ngModels.AlertInstance) {
		i.RuleOrgID = rule.OrgID
		i.RuleUID = rule.UID
		i.Labels = labels
		i.CurrentState = currentState
	})
}

func TestManager_WarmRuleIfNeeded(t *testing.T) {
	t.Run("loads and maps the persisted states after a gap", func(t *testing.T) {
		rule := newWarmRule()
		firing := mkWarmInstance(rule, ngModels.InstanceLabels{"pod": "a"}, ngModels.InstanceStateFiring)
		store := &fakeWarmInstanceStore{instances: []*ngModels.AlertInstance{
			firing,
			mkWarmInstance(rule, ngModels.InstanceLabels{"pod": "b"}, ngModels.InstanceStateNormal),
		}}
		st, mockClock := newTargetedWarmManager(store)
		mockClock.Add(TargetedWarmReloadAfter + time.Minute)

		st.TargetedWarm.WarmRuleIfNeeded(context.Background(), rule)

		require.Len(t, store.queries, 1)
		require.Equal(t, rule.OrgID, store.queries[0].RuleOrgID)
		require.Equal(t, rule.UID, store.queries[0].RuleUID)

		states := st.GetStatesForRuleUID(rule.OrgID, rule.UID)
		require.Len(t, states, 2)
		byPod := map[string]*State{}
		for _, s := range states {
			require.Equal(t, rule.UID, s.AlertRuleUID)
			require.Equal(t, rule.OrgID, s.OrgID)
			require.Equal(t, rule.Annotations, map[string]string(s.Annotations))
			byPod[s.Labels["pod"]] = s
		}
		require.Equal(t, eval.Alerting, byPod["a"].State)
		require.Equal(t, eval.Normal, byPod["b"].State)
		require.Equal(t, firing.CurrentStateSince, byPod["a"].StartsAt)
		require.Equal(t, firing.CurrentStateEnd, byPod["a"].EndsAt)
		require.Equal(t, firing.LastEvalTime, byPod["a"].LastEvaluationTime)
	})

	t.Run("does not warm a rule with recent local activity", func(t *testing.T) {
		rule := newWarmRule()
		store := &fakeWarmInstanceStore{}
		st, mockClock := newTargetedWarmManager(store)
		mockClock.Add(TargetedWarmReloadAfter + time.Minute)
		st.logzioObserver.onRuleEvaluated(rule.GetKey(), mockClock.Now())

		st.TargetedWarm.WarmRuleIfNeeded(context.Background(), rule)

		require.Empty(t, store.queries)
	})

	t.Run("does not warm when the startup snapshot is fresh", func(t *testing.T) {
		rule := newWarmRule()
		store := &fakeWarmInstanceStore{}
		st, mockClock := newTargetedWarmManager(store)
		st.logzioObserver.onWarmSnapshotLoaded(map[int64]map[string]*ruleStates{})
		mockClock.Add(time.Minute)

		st.TargetedWarm.WarmRuleIfNeeded(context.Background(), rule)

		require.Empty(t, store.queries)
	})

	t.Run("warms when the startup snapshot is older than the reload window", func(t *testing.T) {
		rule := newWarmRule()
		store := &fakeWarmInstanceStore{}
		st, mockClock := newTargetedWarmManager(store)
		st.logzioObserver.onWarmSnapshotLoaded(map[int64]map[string]*ruleStates{})
		mockClock.Add(TargetedWarmReloadAfter + time.Minute)

		st.TargetedWarm.WarmRuleIfNeeded(context.Background(), rule)

		require.Len(t, store.queries, 1)
	})

	t.Run("keeps the cached states when the database query fails", func(t *testing.T) {
		rule := newWarmRule()
		store := &fakeWarmInstanceStore{instances: []*ngModels.AlertInstance{
			mkWarmInstance(rule, ngModels.InstanceLabels{"pod": "a"}, ngModels.InstanceStateFiring),
		}}
		st, mockClock := newTargetedWarmManager(store)
		mockClock.Add(TargetedWarmReloadAfter + time.Minute)
		st.TargetedWarm.WarmRuleIfNeeded(context.Background(), rule)
		require.Len(t, st.GetStatesForRuleUID(rule.OrgID, rule.UID), 1)

		store.err = errors.New("db is down")
		mockClock.Add(TargetedWarmReloadAfter + time.Minute)
		st.TargetedWarm.WarmRuleIfNeeded(context.Background(), rule)

		states := st.GetStatesForRuleUID(rule.OrgID, rule.UID)
		require.Len(t, states, 1)
		require.Equal(t, "a", states[0].Labels["pod"])
	})

	t.Run("does nothing when the instance store is not configured", func(t *testing.T) {
		rule := newWarmRule()
		st, mockClock := newTargetedWarmManager(nil)
		mockClock.Add(TargetedWarmReloadAfter + time.Minute)

		st.TargetedWarm.WarmRuleIfNeeded(context.Background(), rule)

		require.Empty(t, st.GetStatesForRuleUID(rule.OrgID, rule.UID))
	})

	t.Run("does not warm a paused rule", func(t *testing.T) {
		rule := newWarmRule()
		rule.IsPaused = true
		store := &fakeWarmInstanceStore{}
		st, mockClock := newTargetedWarmManager(store)
		mockClock.Add(TargetedWarmReloadAfter + time.Minute)

		st.TargetedWarm.WarmRuleIfNeeded(context.Background(), rule)

		require.Empty(t, store.queries)
	})

	t.Run("does nothing when targeted warm is disabled", func(t *testing.T) {
		rule := newWarmRule()
		store := &fakeWarmInstanceStore{}
		st, mockClock := newWarmManagerWithFlags(store, false, true)
		mockClock.Add(TargetedWarmReloadAfter + time.Minute)

		st.TargetedWarm.WarmRuleIfNeeded(context.Background(), rule)

		require.Empty(t, store.queries)
	})
}

func TestManager_MaintainCache(t *testing.T) {
	t.Run("runs the full reload outside targeted-warm mode", func(t *testing.T) {
		st, _ := newWarmManagerWithFlags(&fakeWarmInstanceStore{}, false, true)

		st.TargetedWarm.MaintainCache(context.Background(), &FakeRuleReader{})

		require.False(t, st.logzioObserver.lastWarmSnapshotAt().IsZero(), "the full warm must run and record the snapshot baseline")
	})

	t.Run("sweeps instead of reloading in targeted-warm mode", func(t *testing.T) {
		ruleA := newWarmRule()
		store := &fakeWarmInstanceStore{}
		st, mockClock := newWarmManagerWithFlags(store, true, false)
		st.cache.set(&State{OrgID: ruleA.OrgID, AlertRuleUID: ruleA.UID, CacheID: "a"})
		mockClock.Add(TargetedWarmEvictAfter + time.Minute)

		st.TargetedWarm.MaintainCache(context.Background(), &FakeRuleReader{})

		require.True(t, st.logzioObserver.lastWarmSnapshotAt().IsZero(), "the full warm must not run")
		require.Empty(t, store.queries, "with the shadow compare off there must be no database reads")
		require.Empty(t, st.GetStatesForRuleUID(ruleA.OrgID, ruleA.UID), "the idle sweep must run")
	})

	t.Run("keeps the shadow compare cycle while it is enabled", func(t *testing.T) {
		store := &fakeWarmInstanceStore{orgIds: []int64{1}}
		st, _ := newWarmManagerWithFlags(store, true, true)

		st.TargetedWarm.MaintainCache(context.Background(), &FakeRuleReader{})

		require.NotEmpty(t, store.queries, "the shadow compare must keep loading the snapshot")
		require.True(t, st.logzioObserver.lastWarmSnapshotAt().IsZero(), "the shadow load must not advance the snapshot baseline")
	})
}

func TestManager_SweepIdleRuleStates(t *testing.T) {
	mkCachedState := func(rule *ngModels.AlertRule, id string) *State {
		return &State{OrgID: rule.OrgID, AlertRuleUID: rule.UID, CacheID: id}
	}

	t.Run("frees the states of idle rules, cache only", func(t *testing.T) {
		ruleA := newWarmRule()
		ruleB := newWarmRule()
		store := &fakeWarmInstanceStore{}
		st, mockClock := newTargetedWarmManager(store)
		st.cache.set(mkCachedState(ruleA, "a"))
		st.cache.set(mkCachedState(ruleB, "b"))

		mockClock.Add(TargetedWarmEvictAfter + time.Minute)
		st.logzioObserver.onRuleEvaluated(ruleA.GetKey(), mockClock.Now())

		st.TargetedWarm.sweepIdleRuleStates()

		require.Len(t, st.GetStatesForRuleUID(ruleA.OrgID, ruleA.UID), 1, "recently evaluated rule must keep its states")
		require.Empty(t, st.GetStatesForRuleUID(ruleB.OrgID, ruleB.UID), "idle rule states must be freed")
		require.Zero(t, store.deletes, "the sweep must never touch the database")
	})

	t.Run("keeps everything within the idle threshold after a fresh warm", func(t *testing.T) {
		ruleA := newWarmRule()
		st, mockClock := newTargetedWarmManager(&fakeWarmInstanceStore{})
		st.cache.set(mkCachedState(ruleA, "a"))
		st.logzioObserver.onWarmSnapshotLoaded(map[int64]map[string]*ruleStates{})

		mockClock.Add(time.Minute)
		st.TargetedWarm.sweepIdleRuleStates()

		require.Len(t, st.GetStatesForRuleUID(ruleA.OrgID, ruleA.UID), 1)
	})

	t.Run("prunes stale activity entries", func(t *testing.T) {
		ruleA := newWarmRule()
		st, mockClock := newTargetedWarmManager(&fakeWarmInstanceStore{})
		st.logzioObserver.onRuleEvaluated(ruleA.GetKey(), mockClock.Now())

		mockClock.Add(TargetedWarmEvictAfter + time.Minute)
		st.TargetedWarm.sweepIdleRuleStates()

		require.Empty(t, st.logzioObserver.ruleActivity.entries())
	})
}

func TestManager_ShadowWarmCompare(t *testing.T) {
	t.Run("compares the loaded snapshot without applying it", func(t *testing.T) {
		rule := newWarmRule()
		now := time.Now().UTC()
		cached := &State{
			OrgID:              rule.OrgID,
			AlertRuleUID:       rule.UID,
			CacheID:            "pod=a",
			State:              eval.Normal,
			LastEvaluationTime: now,
		}
		dbInstance := mkWarmInstance(rule, ngModels.InstanceLabels{"pod": "a"}, ngModels.InstanceStateFiring)
		dbInstance.LastEvalTime = now.Add(time.Minute)

		store := &fakeWarmInstanceStore{orgIds: []int64{rule.OrgID}, instances: []*ngModels.AlertInstance{dbInstance}}
		st, mockClock := newTargetedWarmManager(store)
		mockClock.Set(now)

		cacheID, err := dbInstance.Labels.StringKey()
		require.NoError(t, err)
		cached.CacheID = cacheID
		st.cache.set(cached)
		st.logzioObserver.onRuleEvaluated(rule.GetKey(), now)

		summary := st.TargetedWarm.shadowWarmCompare(context.Background())

		require.NotNil(t, summary)
		require.Equal(t, 1, summary.activeRules)
		require.Equal(t, 1, summary.newerInDB, "the newer database row must be flagged")

		states := st.GetStatesForRuleUID(rule.OrgID, rule.UID)
		require.Len(t, states, 1)
		require.Equal(t, eval.Normal, states[0].State, "the cache must stay untouched")
		require.Equal(t, now, states[0].LastEvaluationTime, "the cache must stay untouched")
		require.True(t, st.logzioObserver.lastWarmSnapshotAt().IsZero(), "shadow compare must not advance the warm freshness baseline")
	})

	t.Run("returns nil when the instance store is not configured", func(t *testing.T) {
		st, _ := newTargetedWarmManager(nil)
		require.Nil(t, st.TargetedWarm.shadowWarmCompare(context.Background()))
	})
}

// LOGZ.IO GRAFANA CHANGE :: End
