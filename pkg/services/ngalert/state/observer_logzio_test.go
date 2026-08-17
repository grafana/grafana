package state

// LOGZ.IO GRAFANA CHANGE :: APPZ-3028 Logzio state observer

import (
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestLogzioStateObserver_CompareSnapshotWithCache(t *testing.T) {
	key := ngModels.AlertRuleKey{OrgID: 1, UID: "rule-1"}

	newManager := func() (*Manager, *clock.Mock) {
		mockClock := clock.NewMock()
		st := NewManager(ManagerCfg{
			Clock: mockClock,
			Log:   log.New("ngalert.state.manager.test"),
		}, NewNoopPersister())
		return st, mockClock
	}

	mkState := func(cacheID string, lastEval time.Time, evalState eval.State) *State {
		return &State{
			OrgID:              key.OrgID,
			AlertRuleUID:       key.UID,
			CacheID:            cacheID,
			State:              evalState,
			LastEvaluationTime: lastEval,
		}
	}

	mkSnapshot := func(states ...*State) map[int64]map[string]*ruleStates {
		rs := &ruleStates{states: make(map[string]*State, len(states))}
		for _, s := range states {
			rs.states[s.CacheID] = s
		}
		return map[int64]map[string]*ruleStates{key.OrgID: {key.UID: rs}}
	}

	t.Run("checks nothing when no rule was evaluated on this pod (startup)", func(t *testing.T) {
		st, mockClock := newManager()

		summary := st.logzioObserver.compareSnapshotWithCache(mkSnapshot(mkState("a", mockClock.Now(), eval.Normal)))

		require.Equal(t, 0, summary.activeRules)
		require.Equal(t, 0, summary.statesChecked)
	})

	t.Run("no discrepancies when snapshot matches the cache", func(t *testing.T) {
		st, mockClock := newManager()
		now := mockClock.Now()
		st.cache.set(mkState("a", now, eval.Alerting))
		st.logzioObserver.onRuleEvaluated(key, now)

		summary := st.logzioObserver.compareSnapshotWithCache(mkSnapshot(mkState("a", now, eval.Alerting)))

		require.Equal(t, 1, summary.activeRules)
		require.Equal(t, 1, summary.statesChecked)
		require.Equal(t, 0, summary.missingInCache+summary.newerInDB+summary.valueMismatch)
	})

	t.Run("flags a snapshot row newer than the cache", func(t *testing.T) {
		st, mockClock := newManager()
		now := mockClock.Now()
		st.cache.set(mkState("a", now, eval.Normal))
		st.logzioObserver.onRuleEvaluated(key, now)

		summary := st.logzioObserver.compareSnapshotWithCache(mkSnapshot(mkState("a", now.Add(time.Minute), eval.Normal)))

		require.Equal(t, 1, summary.newerInDB)
	})

	t.Run("tolerates timestamp precision loss within the epsilon", func(t *testing.T) {
		st, mockClock := newManager()
		now := mockClock.Now()
		st.cache.set(mkState("a", now, eval.Normal))
		st.logzioObserver.onRuleEvaluated(key, now)

		summary := st.logzioObserver.compareSnapshotWithCache(mkSnapshot(mkState("a", now.Add(500*time.Millisecond), eval.Normal)))

		require.Equal(t, 0, summary.newerInDB+summary.valueMismatch)
	})

	t.Run("flags a snapshot row the cache lacks", func(t *testing.T) {
		st, mockClock := newManager()
		now := mockClock.Now()
		st.cache.set(mkState("a", now, eval.Normal))
		st.logzioObserver.onRuleEvaluated(key, now)

		summary := st.logzioObserver.compareSnapshotWithCache(mkSnapshot(
			mkState("a", now, eval.Normal),
			mkState("b", now, eval.Alerting),
		))

		require.Equal(t, 1, summary.missingInCache)
	})

	t.Run("flags different content at the same evaluation time", func(t *testing.T) {
		st, mockClock := newManager()
		now := mockClock.Now()
		st.cache.set(mkState("a", now, eval.Normal))
		st.logzioObserver.onRuleEvaluated(key, now)

		summary := st.logzioObserver.compareSnapshotWithCache(mkSnapshot(mkState("a", now, eval.Alerting)))

		require.Equal(t, 1, summary.valueMismatch)
	})

	t.Run("ignores cache rows newer than the snapshot", func(t *testing.T) {
		st, mockClock := newManager()
		now := mockClock.Now()
		st.cache.set(mkState("a", now.Add(time.Minute), eval.Alerting))
		st.logzioObserver.onRuleEvaluated(key, now.Add(time.Minute))

		summary := st.logzioObserver.compareSnapshotWithCache(mkSnapshot(mkState("a", now, eval.Normal)))

		require.Equal(t, 0, summary.missingInCache+summary.newerInDB+summary.valueMismatch)
	})

	t.Run("ignores rules not evaluated on this pod", func(t *testing.T) {
		st, mockClock := newManager()
		// The snapshot diverges from the (empty) cache, but the rule has no local activity.
		summary := st.logzioObserver.compareSnapshotWithCache(mkSnapshot(mkState("a", mockClock.Now(), eval.Alerting)))

		require.Equal(t, 0, summary.activeRules)
		require.Equal(t, 0, summary.missingInCache+summary.newerInDB+summary.valueMismatch)
	})

	t.Run("drops activity older than the active window", func(t *testing.T) {
		st, mockClock := newManager()
		st.cache.set(mkState("a", mockClock.Now(), eval.Normal))
		st.logzioObserver.onRuleEvaluated(key, mockClock.Now())
		mockClock.Add(compareActiveWindow + time.Minute)

		summary := st.logzioObserver.compareSnapshotWithCache(mkSnapshot(mkState("a", mockClock.Now(), eval.Alerting)))

		require.Equal(t, 0, summary.activeRules)
		require.Empty(t, st.logzioObserver.ruleActivity.entries())
	})
}

// LOGZ.IO GRAFANA CHANGE :: End
