package state

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

var _ InstanceStore = &FakeInstanceStore{}

type FakeInstanceStore struct {
	mtx         sync.Mutex
	RecordedOps []interface{}
}

func (f *FakeInstanceStore) ListAlertInstances(_ context.Context, q *models.ListAlertInstancesQuery) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)
	return nil
}

func (f *FakeInstanceStore) SaveAlertInstances(_ context.Context, q ...models.AlertInstance) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	for _, inst := range q {
		f.RecordedOps = append(f.RecordedOps, inst)
	}
	return nil
}

func (f *FakeInstanceStore) FetchOrgIds(_ context.Context) ([]int64, error) { return []int64{}, nil }

func (f *FakeInstanceStore) DeleteAlertInstances(_ context.Context, _ ...models.AlertInstanceKey) error {
	return nil
}

func (f *FakeInstanceStore) DeleteAlertInstancesByRule(ctx context.Context, key models.AlertRuleKey) error {
	return nil
}

type FakeRuleReader struct{}

func (f *FakeRuleReader) ListAlertRules(_ context.Context, q *models.ListAlertRulesQuery) error {
	return nil
}

type FakeHistorian struct{}

func (f *FakeHistorian) RecordState(ctx context.Context, rule *models.AlertRule, labels data.Labels, result *eval.Result, evaluatedAt time.Time, currentData, previousData InstanceStateAndReason) {
}
