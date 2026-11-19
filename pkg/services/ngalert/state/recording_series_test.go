package state

import (
	"context"
	"errors"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type fakeSeriesStore struct {
	mtx       sync.Mutex
	stored    map[int64]map[string][]models.RecordingSeries
	listErr   map[int64]error
	saveErr   error
	lists     int
	saves     []savedSeries
	deletes   []models.AlertRuleKeyWithGroup
	fullSyncs int
}

type savedSeries struct {
	key    models.AlertRuleKeyWithGroup
	series []models.RecordingSeries
}

func (f *fakeSeriesStore) SaveRecordingSeriesForRule(_ context.Context, key models.AlertRuleKeyWithGroup, series []models.RecordingSeries) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	if f.saveErr != nil {
		return f.saveErr
	}
	f.saves = append(f.saves, savedSeries{key: key, series: series})
	return nil
}

func (f *fakeSeriesStore) ListRecordingSeries(_ context.Context, orgID int64) (map[string][]models.RecordingSeries, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.lists++
	if err := f.listErr[orgID]; err != nil {
		return nil, err
	}
	return f.stored[orgID], nil
}

func (f *fakeSeriesStore) DeleteRecordingSeriesForRule(_ context.Context, key models.AlertRuleKeyWithGroup) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.deletes = append(f.deletes, key)
	return nil
}

func (f *fakeSeriesStore) FullSyncWithSeries(context.Context, []models.AlertInstance, map[models.AlertRuleKey][]models.RecordingSeries, int, func(int) time.Duration) error {
	f.fullSyncs++
	return nil
}

type fakeInstanceAndSeriesStore struct {
	*FakeInstanceStore
	*fakeSeriesStore
}

func seriesTestRule(uid string) *models.AlertRule {
	return models.RuleGen.With(
		models.RuleGen.WithAllRecordingRules(),
		models.RuleGen.WithOrgID(1),
		models.RuleGen.WithUID(uid),
		models.RuleGen.WithIntervalSeconds(10),
	).GenerateRef()
}

func seriesLabels(ids ...int) []data.Labels {
	out := make([]data.Labels, 0, len(ids))
	for _, id := range ids {
		out = append(out, data.Labels{"job": "x", "id": strconv.Itoa(id)})
	}
	return out
}

func newSeriesTestManager(cfg RecordingSeriesCfg, store RecordingSeriesStore) (*RecordingSeriesManager, *metrics.Scheduler) {
	m := metrics.NewSchedulerMetrics(prometheus.NewPedanticRegistry())
	cfg.Metrics = m
	return newRecordingSeriesManager(cfg, store, AlwaysReady{}, clock.NewMock(), log.NewNopLogger()), m
}

var (
	seriesTarget1 = SeriesTarget{DatasourceUID: "ds1", Metric: "metric"}
	seriesTarget2 = SeriesTarget{DatasourceUID: "ds2", Metric: "metric"}
	seriesTick0   = time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	seriesTick1   = seriesTick0.Add(10 * time.Second)
	seriesTick2   = seriesTick1.Add(10 * time.Second)
)

func labelIDs(stale []StaleSeries) []string {
	ids := make([]string, 0, len(stale))
	for _, s := range stale {
		ids = append(ids, s.Labels["id"])
	}
	return ids
}

func TestRecordingSeriesManager_Track(t *testing.T) {
	t.Run("a series that goes missing is stale at the next tick, not the one after", func(t *testing.T) {
		m, _ := newSeriesTestManager(RecordingSeriesCfg{}, nil)
		rule := seriesTestRule("r")

		require.Empty(t, m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1, 2)))
		stale := m.Track(rule, seriesTarget1, seriesTick1, seriesLabels(1))

		require.ElementsMatch(t, []string{"2"}, labelIDs(stale))
		require.Equal(t, seriesTarget1, stale[0].Target)
		require.EqualValues(t, 1, m.Tracked())
	})

	t.Run("a stale series is reported once", func(t *testing.T) {
		m, _ := newSeriesTestManager(RecordingSeriesCfg{}, nil)
		rule := seriesTestRule("r")

		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1, 2))
		require.Len(t, m.Track(rule, seriesTarget1, seriesTick1, seriesLabels(1)), 1)
		require.Empty(t, m.Track(rule, seriesTarget1, seriesTick2, seriesLabels(1)))
	})

	t.Run("a returned series is not tracked any more and never comes back", func(t *testing.T) {
		m, _ := newSeriesTestManager(RecordingSeriesCfg{}, nil)
		rule := seriesTestRule("r")
		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1, 2))

		require.Equal(t, []string{"2"}, labelIDs(m.Track(rule, seriesTarget1, seriesTick1, seriesLabels(1))))

		require.Empty(t, m.Track(rule, seriesTarget1, seriesTick2, seriesLabels(1)))
		require.Equal(t, []string{"1"}, labelIDs(m.Track(rule, seriesTarget1, seriesTick2.Add(10*time.Second), nil)))
		require.Empty(t, m.GetRecordingSeries())
		require.Zero(t, m.Tracked())
	})

	t.Run("a series that keeps being output is never stale", func(t *testing.T) {
		m, _ := newSeriesTestManager(RecordingSeriesCfg{}, nil)
		rule := seriesTestRule("r")

		for i := 0; i < 5; i++ {
			require.Empty(t, m.Track(rule, seriesTarget1, seriesTick0.Add(time.Duration(i)*10*time.Second), seriesLabels(1, 2)))
		}
		require.EqualValues(t, 2, m.Tracked())
	})

	t.Run("the entries are not alert state", func(t *testing.T) {
		mgr := NewManager(ManagerCfg{Clock: clock.NewMock(), Log: log.NewNopLogger(), Tracer: tracing.InitializeTracerForTest(), RecordingSeries: RecordingSeriesCfg{Enabled: true}}, &capturingPersister{})
		rule := seriesTestRule("r")

		mgr.Recording().Track(rule, seriesTarget1, seriesTick0, seriesLabels(1, 2, 3))

		require.Empty(t, mgr.GetAll(context.Background(), rule.OrgID))
		require.Empty(t, mgr.GetStatesForRuleUID(context.Background(), rule.OrgID, rule.UID))
		require.Empty(t, mgr.cache.GetAlertInstances())
	})

	t.Run("rules do not see each other's series", func(t *testing.T) {
		m, _ := newSeriesTestManager(RecordingSeriesCfg{}, nil)
		a, b := seriesTestRule("a"), seriesTestRule("b")

		m.Track(a, seriesTarget1, seriesTick0, seriesLabels(1))
		m.Track(b, seriesTarget1, seriesTick0, seriesLabels(1))

		require.Len(t, m.Track(a, seriesTarget1, seriesTick1, nil), 1)
		require.EqualValues(t, 1, m.Tracked())
	})
}

func TestRecordingSeriesManager_Budget(t *testing.T) {
	t.Run("a refused series is not tracked and the known ones keep their markers", func(t *testing.T) {
		b := NewSeriesBudget(2)
		m, mt := newSeriesTestManager(RecordingSeriesCfg{Budget: b}, nil)
		rule := seriesTestRule("r")

		require.Empty(t, m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1, 2, 3)))
		require.EqualValues(t, 2, m.Tracked())
		require.EqualValues(t, 1, testutil.ToFloat64(mt.RecordingRuleUntrackedSeries))

		stale := m.Track(rule, seriesTarget1, seriesTick1, nil)
		require.Len(t, stale, 2, "the two known series are staled, the untracked one never was")
	})

	t.Run("known series are not asked again", func(t *testing.T) {
		b := NewSeriesBudget(1)
		m, _ := newSeriesTestManager(RecordingSeriesCfg{Budget: b}, nil)
		rule := seriesTestRule("r")

		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1))
		m.Track(rule, seriesTarget1, seriesTick1, seriesLabels(1))

		require.EqualValues(t, 1, b.Used())
		require.EqualValues(t, 1, m.Tracked())
	})

	t.Run("stale series give their room back", func(t *testing.T) {
		b := NewSeriesBudget(1)
		m, _ := newSeriesTestManager(RecordingSeriesCfg{Budget: b}, nil)
		rule := seriesTestRule("r")
		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1, 2))

		stale := m.Track(rule, seriesTarget1, seriesTick1, seriesLabels(2))
		require.Len(t, stale, 1)
		require.Zero(t, b.Used())

		m.Track(rule, seriesTarget1, seriesTick2, seriesLabels(2))
		require.EqualValues(t, 1, b.Used(), "series 2 is admitted once there is room")
	})

	t.Run("forget, delete and stale all give their room back", func(t *testing.T) {
		b := NewSeriesBudget(10)
		m, _ := newSeriesTestManager(RecordingSeriesCfg{Budget: b}, nil)
		a, c, d := seriesTestRule("a"), seriesTestRule("c"), seriesTestRule("d")
		m.Track(a, seriesTarget1, seriesTick0, seriesLabels(1, 2))
		m.Track(c, seriesTarget1, seriesTick0, seriesLabels(1, 2))
		m.Track(d, seriesTarget1, seriesTick0, seriesLabels(1, 2))

		m.Forget(a.GetKey())
		require.EqualValues(t, 4, b.Used())
		require.NoError(t, m.Delete(context.Background(), c.GetKeyWithGroup()))
		require.EqualValues(t, 2, b.Used())
		m.StaleAll(d.GetKey())
		require.Zero(t, b.Used())
	})

	t.Run("a target change gives back the series of the old target", func(t *testing.T) {
		b := NewSeriesBudget(10)
		m, _ := newSeriesTestManager(RecordingSeriesCfg{Budget: b}, nil)
		rule := seriesTestRule("r")
		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1, 2))

		m.Track(rule, seriesTarget2, seriesTick1, seriesLabels(1))

		require.EqualValues(t, 1, b.Used())
		require.EqualValues(t, 1, m.Tracked())
	})

	t.Run("without a budget there is no limit", func(t *testing.T) {
		m, mt := newSeriesTestManager(RecordingSeriesCfg{}, nil)
		ids := make([]int, 500)
		for i := range ids {
			ids[i] = i
		}

		m.Track(seriesTestRule("r"), seriesTarget1, seriesTick0, seriesLabels(ids...))

		require.EqualValues(t, 500, m.Tracked())
		require.Zero(t, testutil.ToFloat64(mt.RecordingRuleUntrackedSeries))
	})

	t.Run("the gauge moves by what the tracker adds and releases, not to its own total", func(t *testing.T) {
		m, mt := newSeriesTestManager(RecordingSeriesCfg{}, nil)
		mt.RecordingRuleTrackedSeries.Set(10)
		rule := seriesTestRule("r")

		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1, 2))
		require.EqualValues(t, 12, testutil.ToFloat64(mt.RecordingRuleTrackedSeries))
		m.Track(rule, seriesTarget1, seriesTick1, seriesLabels(1))
		require.EqualValues(t, 11, testutil.ToFloat64(mt.RecordingRuleTrackedSeries))
		m.reset()
		require.EqualValues(t, 10, testutil.ToFloat64(mt.RecordingRuleTrackedSeries))
	})

	t.Run("the gauge follows the tracked series", func(t *testing.T) {
		m, mt := newSeriesTestManager(RecordingSeriesCfg{}, nil)
		rule := seriesTestRule("r")

		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1, 2))
		require.EqualValues(t, 2, testutil.ToFloat64(mt.RecordingRuleTrackedSeries))
		m.Forget(rule.GetKey())
		require.EqualValues(t, 0, testutil.ToFloat64(mt.RecordingRuleTrackedSeries))
	})
}

func TestRecordingSeriesManager_StaleAll(t *testing.T) {
	t.Run("returns everything even within the interval", func(t *testing.T) {
		m, _ := newSeriesTestManager(RecordingSeriesCfg{}, nil)
		rule := seriesTestRule("r")
		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1, 2))

		stale := m.StaleAll(rule.GetKey())

		require.ElementsMatch(t, []string{"1", "2"}, labelIDs(stale))
		require.Zero(t, m.Tracked())
		require.Empty(t, m.StaleAll(rule.GetKey()))
	})

	t.Run("covers every target of the rule", func(t *testing.T) {
		rule := seriesTestRule("r")
		store := &fakeSeriesStore{stored: map[int64]map[string][]models.RecordingSeries{1: {
			"r": {storedSeries(1, seriesTarget1, seriesTick0), storedSeries(2, seriesTarget2, seriesTick0)},
		}}}
		m, _ := newSeriesTestManager(RecordingSeriesCfg{}, store)
		m.warm(context.Background(), 1, map[string]*models.AlertRule{"r": rule}, log.NewNopLogger())

		stale := m.StaleAll(rule.GetKey())

		require.Len(t, stale, 2)
	})
}

func TestRecordingSeriesManager_TargetChange(t *testing.T) {
	t.Run("series that stay on the same metric are live, the others get a marker at the old target", func(t *testing.T) {
		m, _ := newSeriesTestManager(RecordingSeriesCfg{}, nil)
		rule := seriesTestRule("r")
		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1, 2))

		stale := m.Track(rule, seriesTarget2, seriesTick1, seriesLabels(1))

		require.Equal(t, []string{"2"}, labelIDs(stale))
		require.Equal(t, seriesTarget1, stale[0].Target)
		require.EqualValues(t, 1, m.Tracked())
	})

	t.Run("a new metric stales every series of the old one", func(t *testing.T) {
		m, _ := newSeriesTestManager(RecordingSeriesCfg{}, nil)
		rule := seriesTestRule("r")
		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1, 2))

		stale := m.Track(rule, SeriesTarget{DatasourceUID: "ds1", Metric: "other"}, seriesTick1, seriesLabels(1, 2))

		require.ElementsMatch(t, []string{"1", "2"}, labelIDs(stale))
		require.Equal(t, seriesTarget1, stale[0].Target)
		require.EqualValues(t, 2, m.Tracked())
	})
}

func TestRecordingSeriesManager_ForgetAndDelete(t *testing.T) {
	t.Run("forget drops memory and leaves the store alone", func(t *testing.T) {
		store := &fakeSeriesStore{}
		m, _ := newSeriesTestManager(RecordingSeriesCfg{WriteThrough: true}, store)
		rule := seriesTestRule("r")
		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1))

		m.Forget(rule.GetKey())

		require.Zero(t, m.Tracked())
		require.Empty(t, m.GetRecordingSeries())
		require.Empty(t, store.deletes)
	})

	t.Run("delete drops memory and the stored series", func(t *testing.T) {
		store := &fakeSeriesStore{}
		m, _ := newSeriesTestManager(RecordingSeriesCfg{}, store)
		rule := seriesTestRule("r")
		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1))

		require.NoError(t, m.Delete(context.Background(), rule.GetKeyWithGroup()))

		require.Zero(t, m.Tracked())
		require.Equal(t, []models.AlertRuleKeyWithGroup{rule.GetKeyWithGroup()}, store.deletes)
	})

	t.Run("delete without a store is memory only", func(t *testing.T) {
		m, _ := newSeriesTestManager(RecordingSeriesCfg{}, nil)
		rule := seriesTestRule("r")
		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1))

		require.NoError(t, m.Delete(context.Background(), rule.GetKeyWithGroup()))
		require.Zero(t, m.Tracked())
	})
}

func advanceSeriesClock(m *RecordingSeriesManager, d time.Duration) {
	m.clock.(*clock.Mock).Add(d)
}

func TestRecordingSeriesManager_Persist(t *testing.T) {
	ctx := context.Background()
	interval := DefaultRecordingSeriesSaveInterval

	t.Run("saves only when the tracked series changed", func(t *testing.T) {
		store := &fakeSeriesStore{}
		m, _ := newSeriesTestManager(RecordingSeriesCfg{WriteThrough: true}, store)
		rule := seriesTestRule("r")
		key := rule.GetKeyWithGroup()

		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1, 2))
		require.NoError(t, m.Persist(ctx, key))
		require.Len(t, store.saves, 1)
		require.Len(t, store.saves[0].series, 2)

		advanceSeriesClock(m, interval)
		m.Track(rule, seriesTarget1, seriesTick1, seriesLabels(1, 2))
		require.NoError(t, m.Persist(ctx, key))
		require.Len(t, store.saves, 1, "an unchanged set is not rewritten")

		m.Track(rule, seriesTarget1, seriesTick2, seriesLabels(1))
		require.NoError(t, m.Persist(ctx, key))
		require.Len(t, store.saves, 2)
		require.Len(t, store.saves[1].series, 1)
	})

	t.Run("many changes within the interval are one save, the next one waits for the interval", func(t *testing.T) {
		store := &fakeSeriesStore{}
		m, _ := newSeriesTestManager(RecordingSeriesCfg{WriteThrough: true}, store)
		rule := seriesTestRule("r")
		key := rule.GetKeyWithGroup()

		for i := 0; i < 5; i++ {
			m.Track(rule, seriesTarget1, seriesTick0.Add(time.Duration(i)*10*time.Second), seriesLabels(i))
			require.NoError(t, m.Persist(ctx, key))
			advanceSeriesClock(m, 10*time.Second)
		}
		require.Len(t, store.saves, 1, "the first change is saved at once, the others are held back")

		advanceSeriesClock(m, interval)
		require.NoError(t, m.Persist(ctx, key))
		require.Len(t, store.saves, 2, "what was held back is saved after the interval, without another change")
		require.Len(t, store.saves[1].series, 1)

		advanceSeriesClock(m, interval)
		require.NoError(t, m.Persist(ctx, key))
		require.Len(t, store.saves, 2, "nothing changed since")
	})

	t.Run("flush saves a held back change at once", func(t *testing.T) {
		store := &fakeSeriesStore{}
		m, _ := newSeriesTestManager(RecordingSeriesCfg{WriteThrough: true}, store)
		rule := seriesTestRule("r")
		key := rule.GetKeyWithGroup()
		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1))
		require.NoError(t, m.Persist(ctx, key))
		m.Track(rule, seriesTarget1, seriesTick1, seriesLabels(1, 2))
		require.NoError(t, m.Persist(ctx, key))
		require.Len(t, store.saves, 1)

		require.NoError(t, m.Flush(ctx, key))
		require.Len(t, store.saves, 2)
		require.Len(t, store.saves[1].series, 2)

		require.NoError(t, m.Flush(ctx, key))
		require.Len(t, store.saves, 2, "a clean rule is not saved")
	})

	t.Run("an emptied set is saved as an empty set", func(t *testing.T) {
		store := &fakeSeriesStore{}
		m, _ := newSeriesTestManager(RecordingSeriesCfg{WriteThrough: true}, store)
		rule := seriesTestRule("r")
		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1))
		require.NoError(t, m.Persist(ctx, rule.GetKeyWithGroup()))

		advanceSeriesClock(m, interval)
		m.Track(rule, seriesTarget1, seriesTick1, nil)
		require.NoError(t, m.Persist(ctx, rule.GetKeyWithGroup()))

		require.Len(t, store.saves, 2)
		require.Empty(t, store.saves[1].series)
	})

	t.Run("a failed save is retried after the interval, not on every tick", func(t *testing.T) {
		store := &fakeSeriesStore{saveErr: errors.New("db down")}
		m, _ := newSeriesTestManager(RecordingSeriesCfg{WriteThrough: true}, store)
		rule := seriesTestRule("r")
		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1))

		require.Error(t, m.Persist(ctx, rule.GetKeyWithGroup()))
		store.saveErr = nil
		require.NoError(t, m.Persist(ctx, rule.GetKeyWithGroup()))
		require.Empty(t, store.saves)

		advanceSeriesClock(m, interval)
		require.NoError(t, m.Persist(ctx, rule.GetKeyWithGroup()))
		require.Len(t, store.saves, 1)
	})

	t.Run("does nothing without write-through", func(t *testing.T) {
		store := &fakeSeriesStore{}
		m, _ := newSeriesTestManager(RecordingSeriesCfg{}, store)
		rule := seriesTestRule("r")
		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1))

		require.NoError(t, m.Persist(ctx, rule.GetKeyWithGroup()))
		require.NoError(t, m.Flush(ctx, rule.GetKeyWithGroup()))

		require.Empty(t, store.saves)
	})

	t.Run("does nothing without a store", func(t *testing.T) {
		m, _ := newSeriesTestManager(RecordingSeriesCfg{WriteThrough: true}, nil)
		rule := seriesTestRule("r")
		m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1))

		require.NoError(t, m.Persist(ctx, rule.GetKeyWithGroup()))
	})

	t.Run("does nothing for a rule that is not tracked", func(t *testing.T) {
		store := &fakeSeriesStore{}
		m, _ := newSeriesTestManager(RecordingSeriesCfg{WriteThrough: true}, store)

		require.NoError(t, m.Flush(ctx, seriesTestRule("r").GetKeyWithGroup()))
		require.Empty(t, store.saves)
	})
}

func TestRecordingSeriesManager_Accounting(t *testing.T) {
	ctx := context.Background()
	assertAccounting := func(t *testing.T, step string, b *SeriesBudget, m *RecordingSeriesManager, want int64) {
		t.Helper()
		require.Equal(t, want, m.Tracked(), step)
		require.Equal(t, m.Tracked(), b.Used(), "%s: the budget and the caches disagree", step)
	}

	b := NewSeriesBudget(1000)
	store := &fakeSeriesStore{stored: map[int64]map[string][]models.RecordingSeries{1: {
		"warm": {storedSeries(1, seriesTarget1, seriesTick0), storedSeries(2, seriesTarget1, seriesTick0)},
	}}}
	m, _ := newSeriesTestManager(RecordingSeriesCfg{Budget: b}, store)
	a, c, d, warm := seriesTestRule("a"), seriesTestRule("c"), seriesTestRule("d"), seriesTestRule("warm")

	m.warm(ctx, 1, map[string]*models.AlertRule{"warm": warm}, log.NewNopLogger())
	assertAccounting(t, "Warm", b, m, 2)

	m.Track(a, seriesTarget1, seriesTick0, seriesLabels(1, 2, 3))
	assertAccounting(t, "Track", b, m, 5)

	m.Track(a, seriesTarget1, seriesTick1, seriesLabels(1))
	assertAccounting(t, "Track with missing series", b, m, 3)

	m.Track(a, seriesTarget2, seriesTick2, seriesLabels(1))
	assertAccounting(t, "Track with a new target", b, m, 3)

	m.Track(c, seriesTarget1, seriesTick0, seriesLabels(1, 2))
	m.Track(d, seriesTarget1, seriesTick0, seriesLabels(1, 2))
	assertAccounting(t, "Track of more rules", b, m, 7)

	m.StaleAll(c.GetKey())
	assertAccounting(t, "StaleAll", b, m, 5)

	m.Forget(d.GetKey())
	assertAccounting(t, "Forget", b, m, 3)

	require.NoError(t, m.Delete(ctx, a.GetKeyWithGroup()))
	assertAccounting(t, "Delete", b, m, 2)

	m.reset()
	assertAccounting(t, "ClearCache", b, m, 0)
}

func TestRecordingSeriesManager_ResetGivesRoomBack(t *testing.T) {
	b := NewSeriesBudget(2)
	mgr := NewManager(ManagerCfg{
		Clock:           clock.NewMock(),
		Log:             log.NewNopLogger(),
		Tracer:          tracing.InitializeTracerForTest(),
		RecordingSeries: RecordingSeriesCfg{Enabled: true, Budget: b},
	}, &capturingPersister{})
	rule := seriesTestRule("r")
	mgr.Recording().Track(rule, seriesTarget1, seriesTick0, seriesLabels(1, 2, 3))
	require.EqualValues(t, 2, b.Used())

	mgr.ClearCache()

	require.Zero(t, b.Used())
	mgr.Recording().Track(rule, seriesTarget1, seriesTick1, seriesLabels(4, 5))
	require.EqualValues(t, 2, mgr.Recording().Tracked(), "new series are admitted again")
}

func TestRecordingSeriesManager_Concurrency(t *testing.T) {
	b := NewSeriesBudget(500)
	m, _ := newSeriesTestManager(RecordingSeriesCfg{Budget: b, WriteThrough: true}, &fakeSeriesStore{})
	ctx := context.Background()
	rules := make([]*models.AlertRule, 8)
	for i := range rules {
		rules[i] = seriesTestRule("rule-" + strconv.Itoa(i))
	}

	var wg sync.WaitGroup
	for _, rule := range rules {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for tick := 0; tick < 50; tick++ {
				at := seriesTick0.Add(time.Duration(tick) * 10 * time.Second)
				m.Track(rule, seriesTarget1, at, seriesLabels(tick, tick+1, tick+2))
				_ = m.Persist(ctx, rule.GetKeyWithGroup())
				switch tick % 17 {
				case 5:
					m.Forget(rule.GetKey())
				case 11:
					m.StaleAll(rule.GetKey())
				}
			}
		}()
	}
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 50; i++ {
			m.GetRecordingSeries()
			if i%20 == 10 {
				m.reset()
			}
		}
	}()
	wg.Wait()

	m.reset()
	require.Zero(t, m.Tracked())
	require.Zero(t, b.Used(), "every admitted series was given back")
}

func TestRecordingSeriesManager_GetRecordingSeries(t *testing.T) {
	m, _ := newSeriesTestManager(RecordingSeriesCfg{}, nil)
	rule := seriesTestRule("r")
	m.Track(rule, seriesTarget1, seriesTick0, seriesLabels(1))
	m.Track(seriesTestRule("empty"), seriesTarget1, seriesTick0, nil)

	got := m.GetRecordingSeries()

	require.Len(t, got, 1, "a rule without series is left out")
	require.Equal(t, []models.RecordingSeries{{
		TargetDatasourceUID: "ds1",
		Metric:              "metric",
		Labels:              data.Labels{"job": "x", "id": "1"},
		LastUpdate:          seriesTick0,
	}}, got[rule.GetKey()])
}

type fakeSeriesOrgReader struct{ orgs []int64 }

func (f fakeSeriesOrgReader) FetchOrgIds(context.Context) ([]int64, error) { return f.orgs, nil }

type fakeSeriesRuleReader struct{ rules models.RulesGroup }

func (f fakeSeriesRuleReader) ListAlertRules(context.Context, *models.ListAlertRulesQuery) (models.RulesGroup, error) {
	return f.rules, nil
}

func storedSeries(id int, target SeriesTarget, updated time.Time) models.RecordingSeries {
	return models.RecordingSeries{TargetDatasourceUID: target.DatasourceUID, Metric: target.Metric, Labels: seriesLabels(id)[0], LastUpdate: updated}
}

func TestRecordingSeriesManager_Warm(t *testing.T) {
	alertRule := models.RuleGen.With(models.RuleGen.WithOrgID(1), models.RuleGen.WithUID("alert")).GenerateRef()

	t.Run("loads the series of recording rules that exist, and nothing else", func(t *testing.T) {
		rec := seriesTestRule("rec")
		store := &fakeSeriesStore{stored: map[int64]map[string][]models.RecordingSeries{1: {
			"rec":     {storedSeries(1, seriesTarget1, seriesTick0)},
			"alert":   {storedSeries(2, seriesTarget1, seriesTick0)},
			"deleted": {storedSeries(3, seriesTarget1, seriesTick0)},
		}}}
		m, _ := newSeriesTestManager(RecordingSeriesCfg{}, store)

		loaded, ok := m.warm(context.Background(), 1, map[string]*models.AlertRule{"rec": rec, "alert": alertRule}, log.NewNopLogger())

		require.True(t, ok)
		require.Equal(t, 1, loaded)
		require.Equal(t, []models.RecordingSeries{storedSeries(1, seriesTarget1, seriesTick0)}, m.GetRecordingSeries()[rec.GetKey()])
	})

	t.Run("a loaded series gets its marker when the rule stops outputting it", func(t *testing.T) {
		rec := seriesTestRule("rec")
		store := &fakeSeriesStore{stored: map[int64]map[string][]models.RecordingSeries{1: {
			"rec": {storedSeries(1, seriesTarget1, seriesTick0), storedSeries(2, seriesTarget1, seriesTick0)},
		}}}
		m, _ := newSeriesTestManager(RecordingSeriesCfg{}, store)
		m.warm(context.Background(), 1, map[string]*models.AlertRule{"rec": rec}, log.NewNopLogger())

		stale := m.Track(rec, seriesTarget1, seriesTick1, seriesLabels(1))

		require.Equal(t, []string{"2"}, labelIDs(stale))
	})

	t.Run("a stored target that differs from the rule keeps the old target on the marker", func(t *testing.T) {
		rec := seriesTestRule("rec")
		store := &fakeSeriesStore{stored: map[int64]map[string][]models.RecordingSeries{1: {
			"rec": {storedSeries(1, seriesTarget1, seriesTick0)},
		}}}
		m, _ := newSeriesTestManager(RecordingSeriesCfg{}, store)
		m.warm(context.Background(), 1, map[string]*models.AlertRule{"rec": rec}, log.NewNopLogger())

		stale := m.Track(rec, SeriesTarget{DatasourceUID: "ds1", Metric: "renamed"}, seriesTick1, seriesLabels(1))

		require.Equal(t, seriesTarget1, stale[0].Target)
	})

	t.Run("stops at the budget", func(t *testing.T) {
		rec := seriesTestRule("rec")
		store := &fakeSeriesStore{stored: map[int64]map[string][]models.RecordingSeries{1: {
			"rec": {storedSeries(1, seriesTarget1, seriesTick0), storedSeries(2, seriesTarget1, seriesTick0), storedSeries(3, seriesTarget1, seriesTick0)},
		}}}
		m, mt := newSeriesTestManager(RecordingSeriesCfg{Budget: NewSeriesBudget(2)}, store)

		loaded, ok := m.warm(context.Background(), 1, map[string]*models.AlertRule{"rec": rec}, log.NewNopLogger())

		require.True(t, ok)
		require.Equal(t, 2, loaded)
		require.EqualValues(t, 1, testutil.ToFloat64(mt.RecordingRuleUntrackedSeries))
	})

	t.Run("what a rule already tracks wins over the stored series", func(t *testing.T) {
		rec := seriesTestRule("rec")
		store := &fakeSeriesStore{stored: map[int64]map[string][]models.RecordingSeries{1: {
			"rec": {storedSeries(9, seriesTarget1, seriesTick0)},
		}}}
		m, _ := newSeriesTestManager(RecordingSeriesCfg{}, store)
		m.Track(rec, seriesTarget1, seriesTick0, seriesLabels(1))

		loaded, _ := m.warm(context.Background(), 1, map[string]*models.AlertRule{"rec": rec}, log.NewNopLogger())

		require.Zero(t, loaded)
		require.EqualValues(t, 1, m.Tracked())
	})

	t.Run("a read error loads nothing for the org and reports it", func(t *testing.T) {
		store := &fakeSeriesStore{listErr: map[int64]error{1: errors.New("boom")}}
		m, _ := newSeriesTestManager(RecordingSeriesCfg{}, store)

		loaded, ok := m.warm(context.Background(), 1, map[string]*models.AlertRule{"rec": seriesTestRule("rec")}, log.NewNopLogger())

		require.False(t, ok)
		require.Zero(t, loaded)
	})

	t.Run("without a store there is nothing to load", func(t *testing.T) {
		m, _ := newSeriesTestManager(RecordingSeriesCfg{}, nil)

		loaded, ok := m.warm(context.Background(), 1, nil, log.NewNopLogger())

		require.True(t, ok)
		require.Zero(t, loaded)
	})
}

type capturingPersister struct{ provider AlertInstancesProvider }

func (c *capturingPersister) Async(_ context.Context, p AlertInstancesProvider) { c.provider = p }
func (c *capturingPersister) Sync(context.Context, trace.Span, models.AlertRuleKeyWithGroup, StateTransitions) {
}

func newSeriesTestStateManager(t *testing.T, enabled bool, store InstanceStore, persister StatePersister) *Manager {
	t.Helper()
	return NewManager(ManagerCfg{
		Clock:           clock.NewMock(),
		Log:             log.NewNopLogger(),
		Tracer:          tracing.InitializeTracerForTest(),
		InstanceStore:   store,
		RecordingSeries: RecordingSeriesCfg{Enabled: enabled},
	}, persister)
}

func TestManager_RecordingSeries(t *testing.T) {
	newStore := func(rec *models.AlertRule) fakeInstanceAndSeriesStore {
		return fakeInstanceAndSeriesStore{
			FakeInstanceStore: &FakeInstanceStore{},
			fakeSeriesStore: &fakeSeriesStore{stored: map[int64]map[string][]models.RecordingSeries{1: {
				rec.UID: {storedSeries(1, seriesTarget1, seriesTick0)},
			}}},
		}
	}

	t.Run("Warm fills the tracker before the first sync reads it", func(t *testing.T) {
		rec := seriesTestRule("rec")
		store := newStore(rec)
		persister := &capturingPersister{}
		mgr := newSeriesTestStateManager(t, true, store, persister)

		mgr.Warm(context.Background(), fakeSeriesOrgReader{orgs: []int64{1}}, fakeSeriesRuleReader{rules: models.RulesGroup{rec}}, store)
		require.NoError(t, mgr.Run(context.Background()))

		provider, ok := persister.provider.(RecordingSeriesProvider)
		require.True(t, ok, "the persister falls back to a plain full sync, which drops the series, when this fails")
		require.Len(t, provider.GetRecordingSeries()[rec.GetKey()], 1)
		require.Empty(t, persister.provider.GetAlertInstances())
	})

	t.Run("with the feature off nothing is read and the provider has no series", func(t *testing.T) {
		rec := seriesTestRule("rec")
		store := newStore(rec)
		persister := &capturingPersister{}
		mgr := newSeriesTestStateManager(t, false, store, persister)

		mgr.Warm(context.Background(), fakeSeriesOrgReader{orgs: []int64{1}}, fakeSeriesRuleReader{rules: models.RulesGroup{rec}}, store)
		require.NoError(t, mgr.Run(context.Background()))

		require.Zero(t, store.lists)
		_, ok := persister.provider.(RecordingSeriesProvider)
		require.False(t, ok)
		require.Empty(t, mgr.Recording().GetRecordingSeries())
	})

	t.Run("a read error for one org does not stop the others", func(t *testing.T) {
		rec := seriesTestRule("rec")
		store := newStore(rec)
		store.listErr = map[int64]error{2: errors.New("boom")}
		mgr := newSeriesTestStateManager(t, true, store, &capturingPersister{})

		mgr.Warm(context.Background(), fakeSeriesOrgReader{orgs: []int64{2, 1}}, fakeSeriesRuleReader{rules: models.RulesGroup{rec}}, store)

		require.EqualValues(t, 1, mgr.Recording().Tracked())
	})

	t.Run("a store without series support is memory only", func(t *testing.T) {
		mgr := newSeriesTestStateManager(t, true, &FakeInstanceStore{}, &capturingPersister{})
		rule := seriesTestRule("rec")

		mgr.Warm(context.Background(), fakeSeriesOrgReader{orgs: []int64{1}}, fakeSeriesRuleReader{rules: models.RulesGroup{rule}}, &FakeInstanceStore{})
		mgr.Recording().Track(rule, seriesTarget1, seriesTick0, seriesLabels(1))

		require.NoError(t, mgr.Recording().Persist(context.Background(), rule.GetKeyWithGroup()))
		require.EqualValues(t, 1, mgr.Recording().Tracked())
	})

	t.Run("ClearCache forgets the tracked series", func(t *testing.T) {
		mgr := newSeriesTestStateManager(t, true, nil, &capturingPersister{})
		mgr.Recording().Track(seriesTestRule("rec"), seriesTarget1, seriesTick0, seriesLabels(1, 2))

		mgr.ClearCache()

		require.Zero(t, mgr.Recording().Tracked())
		require.Empty(t, mgr.Recording().GetRecordingSeries())
	})

	t.Run("the tracker reports the readiness of the state manager", func(t *testing.T) {
		mgr := NewManager(ManagerCfg{
			Clock:       clock.NewMock(),
			Log:         log.NewNopLogger(),
			Tracer:      tracing.InitializeTracerForTest(),
			RequireWarm: true,
		}, &capturingPersister{})

		require.Equal(t, NotReady, mgr.Recording().Ready())
		mgr.Warm(context.Background(), nil, nil, nil)
		require.Equal(t, Ready, mgr.Recording().Ready())
	})
}

func TestRecordingSeriesManager_ConcurrentForgetOnTheSameRule(t *testing.T) {
	b := NewSeriesBudget(1000)
	m, _ := newSeriesTestManager(RecordingSeriesCfg{Budget: b}, nil)
	rule := seriesTestRule("r")

	var wg sync.WaitGroup
	for g := 0; g < 4; g++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for tick := 0; tick < 300; tick++ {
				at := seriesTick0.Add(time.Duration(tick) * 10 * time.Second)
				m.Track(rule, seriesTarget1, at, seriesLabels(g*1000+tick, g*1000+tick+1))
				if tick%3 == g%3 {
					m.Forget(rule.GetKey())
				}
			}
		}()
	}
	wg.Wait()

	m.Forget(rule.GetKey())
	require.Zero(t, m.Tracked(), "a series added while the rule was removed is not left behind")
	require.Zero(t, b.Used())
}
