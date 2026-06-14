package state

import (
	"context"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// StoreStateReader reads alert instances from the store and returns them as slice of State.
type StoreStateReader struct {
	reader InstanceReader
	log    log.Logger
	cache  sync.Map // map[int64]map[string][]*State (orgID -> ruleUID -> states)
}

func NewStoreStateReader(reader InstanceReader, log log.Logger) *StoreStateReader {
	return &StoreStateReader{
		reader: reader,
		log:    log,
	}
}

func (m *StoreStateReader) GetAll(ctx context.Context, orgID int64) []*State {
	instances, err := m.reader.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
		RuleOrgID: orgID,
	})
	if err != nil {
		m.log.Error("Failed to list alert instances from DB", "orgID", orgID, "error", err)
		return nil
	}
	states := m.convertToStates(instances)
	// Populate cache
	m.cacheStates(orgID, states)
	return states
}

func (m *StoreStateReader) GetStatesForRuleUID(ctx context.Context, orgID int64, alertRuleUID string) []*State {
	// Check cache first
	if states := m.getCachedStates(orgID, alertRuleUID); states != nil {
		return states
	}

	// Cache miss - load all for org
	_ = m.GetAll(ctx, orgID)

	// Try cache again
	if states := m.getCachedStates(orgID, alertRuleUID); states != nil {
		return states
	}

	m.log.Debug("No alert instances found for rule", "orgID", orgID, "ruleUID", alertRuleUID)
	return nil
}

func (m *StoreStateReader) cacheStates(orgID int64, states []*State) {
	orgCache := make(map[string][]*State)
	for _, s := range states {
		orgCache[s.AlertRuleUID] = append(orgCache[s.AlertRuleUID], s)
	}
	m.cache.Store(orgID, orgCache)
}

func (m *StoreStateReader) getCachedStates(orgID int64, ruleUID string) []*State {
	if v, ok := m.cache.Load(orgID); ok {
		orgCache := v.(map[string][]*State)
		return orgCache[ruleUID]
	}
	return nil
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
