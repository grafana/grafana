package state

import (
	"context"
	"strconv"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// defaultStateCacheRefresh is how often the background refresh reloads cached org state
// when no interval is provided.
const defaultStateCacheRefresh = time.Minute

// orgStates is an immutable snapshot of one org's alert states, indexed by rule UID.
// It is replaced atomically; callers must never mutate it.
type orgStates struct {
	all   []*State
	byUID map[string][]*State
}

// StoreStateReader reads alert instances from the store and returns them as a slice of State.
//
// Deserializing alert-instance state from the database is expensive (protobuf decode +
// reflection + GC). Under ha_single_node_evaluation the API serves rule statuses from the
// database on every request, so listing rules would re-deserialize the entire org's state
// on each call. To avoid that, StoreStateReader keeps an in-memory, per-org snapshot of
// already-deserialized state and refreshes it in the background on a fixed interval. Reads
// are served from the snapshot (fast); staleness is bounded by the refresh interval.
type StoreStateReader struct {
	reader  InstanceReader
	log     log.Logger
	refresh time.Duration

	cache sync.Map           // orgID(int64) -> *orgStates
	group singleflight.Group // dedupes concurrent cold loads per org
}

func NewStoreStateReader(reader InstanceReader, log log.Logger, refresh time.Duration) *StoreStateReader {
	if refresh <= 0 {
		refresh = defaultStateCacheRefresh
	}
	return &StoreStateReader{
		reader:  reader,
		log:     log,
		refresh: refresh,
	}
}

// Run periodically refreshes the cached state for every org that has been queried, until
// ctx is cancelled. It must be started once by the owning service (see AlertNG.Run).
func (m *StoreStateReader) Run(ctx context.Context) error {
	t := time.NewTicker(m.refresh)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-t.C:
			m.refreshAll(ctx)
		}
	}
}

// refreshAll reloads, in the background, the state of every org already in the cache.
func (m *StoreStateReader) refreshAll(ctx context.Context) {
	m.cache.Range(func(k, _ any) bool {
		orgID := k.(int64)
		snap, err := m.loadOrg(ctx, orgID)
		if err != nil {
			m.log.Error("Failed to refresh cached alert state", "orgID", orgID, "error", err)
			return true // keep the previous snapshot; try again next tick
		}
		m.cache.Store(orgID, snap)
		return true
	})
}

// snapshot returns the cached snapshot for an org, loading it once on a cold miss.
// Concurrent cold misses for the same org are coalesced so only one DB load happens.
func (m *StoreStateReader) snapshot(ctx context.Context, orgID int64) *orgStates {
	if v, ok := m.cache.Load(orgID); ok {
		return v.(*orgStates)
	}
	v, err, _ := m.group.Do(strconv.FormatInt(orgID, 10), func() (any, error) {
		if v, ok := m.cache.Load(orgID); ok { // another caller populated it
			return v, nil
		}
		snap, err := m.loadOrg(ctx, orgID)
		if err != nil {
			return nil, err
		}
		m.cache.Store(orgID, snap)
		return snap, nil
	})
	if err != nil {
		m.log.Error("Failed to load alert state from DB", "orgID", orgID, "error", err)
		return &orgStates{byUID: map[string][]*State{}}
	}
	return v.(*orgStates)
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
