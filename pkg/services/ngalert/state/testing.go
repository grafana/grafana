package state

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
	"github.com/grafana/grafana/pkg/services/screenshot"
)

var _ InstanceDataStore = &FakeInstanceDataStore{}

type FakeInstanceDataStore struct {
	mtx         sync.Mutex
	RecordedOps []interface{}
}

type FakeInstanceStoreOp struct {
	Name string
	Args []interface{}
}

func (f *FakeInstanceDataStore) ListAlertInstanceData(ctx context.Context, q *models.ListAlertInstancesQuery) ([]*models.AlertInstanceData, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, *q)
	return nil, nil
}

func (f *FakeInstanceDataStore) SaveAlertInstanceData(_ context.Context, alertInstances models.AlertInstanceData) error {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, alertInstances)
	return nil
}

func (f *FakeInstanceDataStore) DeleteAlertInstanceData(_ context.Context, key models.AlertRuleKey) (bool, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, key)
	return true, nil
}

func (f *FakeInstanceDataStore) DeleteExpiredAlertInstanceData(_ context.Context) (int64, error) {
	f.mtx.Lock()
	defer f.mtx.Unlock()
	f.RecordedOps = append(f.RecordedOps, time.Now())
	return 0, nil
}

type FakeRuleReader struct{}

func (f *FakeRuleReader) ListAlertRules(_ context.Context, q *models.ListAlertRulesQuery) (models.RulesGroup, error) {
	return nil, nil
}

type FakeHistorian struct {
	StateTransitions []StateTransition
}

func (f *FakeHistorian) Record(ctx context.Context, rule history_model.RuleMeta, states []StateTransition) <-chan error {
	f.StateTransitions = append(f.StateTransitions, states...)
	errCh := make(chan error)
	close(errCh)
	return errCh
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
