package state

import (
	"context"
	"sync"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type FakeInstanceStore struct {
	mtx         sync.Mutex
	RecordedOps []interface{}
	States      map[int64][]*models.AlertInstance
}

func (f *FakeInstanceStore) ListAlertInstances(_ context.Context, q *models.ListAlertInstancesQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)
	q.Result = f.States[q.RuleOrgID]
	return nil
}

func (f *FakeInstanceStore) SaveAlertInstance(_ context.Context, q *models.SaveAlertInstanceCommand) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)
	return nil
}

func (f *FakeInstanceStore) FetchOrgIds(_ context.Context) ([]int64, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	var orgs []int64
	for orgID := range f.States {
		orgs = append(orgs, orgID)
	}
	return orgs, nil
}

func (f *FakeInstanceStore) DeleteAlertInstance(_ context.Context, _ int64, _, _ string) error {
	return nil
}

func (f *FakeInstanceStore) DeleteAlertInstancesByRule(ctx context.Context, key models.AlertRuleKey) error {
	return nil
}

type FakeRuleReader struct{}

func (f *FakeRuleReader) ListAlertRules(_ context.Context, q *models.ListAlertRulesQuery) error {
	return nil
}
