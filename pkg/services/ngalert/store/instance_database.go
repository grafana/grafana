package store

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// ListAlertInstances is a handler for retrieving alert instances within specific organisation
// based on various filters.
func (st DBstore) ListAlertInstances(ctx context.Context, cmd *models.ListAlertInstancesQuery) (result []*models.AlertInstance, err error) {
	return st.InstanceStore.ListAlertInstances(ctx, cmd)
}

// SaveAlertInstance is a handler for saving a new alert instance.
func (st DBstore) SaveAlertInstance(ctx context.Context, alertInstance models.AlertInstance) error {
	return st.InstanceStore.SaveAlertInstance(ctx, alertInstance)
}

func (st DBstore) FetchOrgIds(ctx context.Context) ([]int64, error) {
	return st.InstanceStore.FetchOrgIds(ctx)
}

// DeleteAlertInstances deletes instances with the provided keys in a single transaction.
func (st DBstore) DeleteAlertInstances(ctx context.Context, keys ...models.AlertInstanceKey) error {
	return st.InstanceStore.DeleteAlertInstances(ctx, keys...)
}

// SaveAlertInstancesForRule is not implemented for instance database store.
func (st DBstore) SaveAlertInstancesForRule(ctx context.Context, key models.AlertRuleKeyWithGroup, instances []models.AlertInstance) error {
	return st.InstanceStore.SaveAlertInstancesForRule(ctx, key, instances)
}

func (st DBstore) DeleteAlertInstancesByRule(ctx context.Context, key models.AlertRuleKeyWithGroup) error {
	return st.InstanceStore.DeleteAlertInstancesByRule(ctx, key)
}

// FullSync performs a full synchronization of the given alert instances to the database.
func (st DBstore) FullSync(ctx context.Context, instances []models.AlertInstance, batchSize int) error {
	return st.InstanceStore.FullSync(ctx, instances, batchSize)
}
