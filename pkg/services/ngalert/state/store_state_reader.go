package state

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// StoreStateReader reads alert instances from the store and returns them as slice of State.
type StoreStateReader struct {
	reader InstanceReader
	log    log.Logger
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
	return m.convertToStates(instances)
}

func (m *StoreStateReader) GetStatesForRuleUID(ctx context.Context, orgID int64, alertRuleUID string) []*State {
	instances, err := m.reader.ListAlertInstances(ctx, &models.ListAlertInstancesQuery{
		RuleOrgID: orgID,
		RuleUID:   alertRuleUID,
	})
	if err != nil {
		m.log.Error("Failed to list alert instances from DB", "orgID", orgID, "ruleUID", alertRuleUID, "error", err)
		return nil
	}
	return m.convertToStates(instances)
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
