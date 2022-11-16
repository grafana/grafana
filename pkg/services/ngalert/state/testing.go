package state

import (
	"context"
	"sync"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/screenshot"
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

func (f *FakeHistorian) RecordStatesAsync(ctx context.Context, rule *models.AlertRule, states []StateTransition) {
}

// NotAvailableImageService is a service that returns ErrScreenshotsUnavailable.
type NotAvailableImageService struct{}

func (s *NotAvailableImageService) NewImage(_ context.Context, _ *models.AlertRule) (*models.Image, error) {
	return nil, screenshot.ErrScreenshotsUnavailable
}

// NoopImageService is a no-op image service.
type NoopImageService struct{}

func (s *NoopImageService) NewImage(_ context.Context, _ *models.AlertRule) (*models.Image, error) {
	return &models.Image{}, nil
}
