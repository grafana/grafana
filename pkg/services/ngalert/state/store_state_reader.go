package state

import (
	"context"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// defaultStateCacheRefresh is the fallback background refresh interval.
const defaultStateCacheRefresh = time.Minute

// stateCacheIdleEviction is how long an org may go unread before its cached state is evicted.
const stateCacheIdleEviction = 15 * time.Minute

// orgStates is an immutable per-org snapshot of alert states, indexed by rule UID.
type orgStates struct {
	all   []*State
	byUID map[string][]*State
}

// orgEntry holds an org's snapshot and when it was last read.
type orgEntry struct {
	snap       atomic.Pointer[orgStates]
	lastAccess atomic.Int64 // unix nanos
}

func (e *orgEntry) touch() {
	e.lastAccess.Store(time.Now().UnixNano())
}

// StoreStateReader serves alert state from the store via per-org in-memory snapshots that are
// refreshed in the background, so reads avoid re-deserializing state on every request.
// Staleness is bounded by the refresh interval.
type StoreStateReader struct {
	reader  InstanceReader
	log     log.Logger
	refresh time.Duration
	metrics *metrics.State

	cache sync.Map           // orgID(int64) -> *orgEntry
	group singleflight.Group // dedupes concurrent cold loads per org
}

// NewStoreStateReader creates a StoreStateReader. metrics may be nil.
func NewStoreStateReader(reader InstanceReader, log log.Logger, refresh time.Duration, metrics *metrics.State) *StoreStateReader {
	if refresh <= 0 {
		refresh = defaultStateCacheRefresh
	}
	return &StoreStateReader{
		reader:  reader,
		log:     log,
		refresh: refresh,
		metrics: metrics,
	}
}

// Run refreshes the cached state of queried orgs until ctx is cancelled.
func (m *StoreStateReader) Run(ctx context.Context) error {
	t := time.NewTicker(m.refresh)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-t.C:
			m.refreshAll(ctx)
		}
	}
}

// refreshAll reloads every recently read org and evicts idle ones.
func (m *StoreStateReader) refreshAll(ctx context.Context) {
	ok := true
	m.cache.Range(func(k, v any) bool {
		orgID := k.(int64)
		entry := v.(*orgEntry)
		if time.Since(time.Unix(0, entry.lastAccess.Load())) > stateCacheIdleEviction {
			m.cache.Delete(orgID)
			return true
		}
		snap, err := m.loadOrg(ctx, orgID)
		if err != nil {
			ok = false
			m.countRefreshFailure()
			m.log.Error("Failed to refresh cached alert state", "orgID", orgID, "error", err)
			return true
		}
		entry.snap.Store(snap)
		return true
	})
	if ok && m.metrics != nil {
		m.metrics.StateCacheLastRefreshSuccess.SetToCurrentTime()
	}
}

func (m *StoreStateReader) countRefreshFailure() {
	if m.metrics != nil {
		m.metrics.StateCacheRefreshFailuresTotal.Inc()
	}
}

// snapshot returns the org's cached snapshot, cold-loading it once (singleflight-deduped).
func (m *StoreStateReader) snapshot(ctx context.Context, orgID int64) *orgStates {
	if v, ok := m.cache.Load(orgID); ok {
		entry := v.(*orgEntry)
		entry.touch()
		return entry.snap.Load()
	}
	v, err, _ := m.group.Do(strconv.FormatInt(orgID, 10), func() (any, error) {
		if v, ok := m.cache.Load(orgID); ok {
			return v, nil
		}
		snap, err := m.loadOrg(ctx, orgID)
		if err != nil {
			return nil, err
		}
		entry := &orgEntry{}
		entry.snap.Store(snap)
		entry.touch()
		m.cache.Store(orgID, entry)
		return entry, nil
	})
	if err != nil {
		m.countRefreshFailure()
		m.log.Error("Failed to load alert state from DB", "orgID", orgID, "error", err)
		return &orgStates{byUID: map[string][]*State{}}
	}
	entry := v.(*orgEntry)
	entry.touch()
	return entry.snap.Load()
}

// loadOrg reads and deserializes all of an org's alert state from the database.
func (m *StoreStateReader) loadOrg(ctx context.Context, orgID int64) (*orgStates, error) {
	instances, err := m.reader.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
		RuleOrgID: orgID,
	})
	if err != nil {
		return nil, err
	}
	states := m.convertToStates(instances)
	byUID := make(map[string][]*State, len(states))
	for _, s := range states {
		byUID[s.AlertRuleUID] = append(byUID[s.AlertRuleUID], s)
	}
	return &orgStates{all: states, byUID: byUID}, nil
}

func (m *StoreStateReader) GetAll(ctx context.Context, orgID int64) []*State {
	return m.snapshot(ctx, orgID).all
}

func (m *StoreStateReader) GetStatesForRuleUID(ctx context.Context, orgID int64, alertRuleUID string) []*State {
	return m.snapshot(ctx, orgID).byUID[alertRuleUID]
}

// StatesByRuleUID returns the org's states indexed by rule UID. Callers must not modify it.
func (m *StoreStateReader) StatesByRuleUID(ctx context.Context, orgID int64) map[string][]*State {
	return m.snapshot(ctx, orgID).byUID
}

func (m *StoreStateReader) Status(ctx context.Context, key models.AlertRuleKey) (models.RuleStatus, bool) {
	states := m.GetStatesForRuleUID(ctx, key.OrgID, key.UID)
	return StatesToRuleStatus(states), len(states) > 0
}

func (m *StoreStateReader) convertToStates(instances []*models.AlertInstance) []*State {
	states := make([]*State, 0, len(instances))
	for _, instance := range instances {
		states = append(states, AlertInstanceToState(instance, m.log))
	}
	return states
}
