package quotatest

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/quota"
)

type FakeQuotaService struct {
	reached bool
	err     error
}

func NewQuotaServiceFake(reached bool, err error) *FakeQuotaService {
	return &FakeQuotaService{reached, err}
}

func (f *FakeQuotaService) Get(ctx context.Context, scope string, id int64) ([]quota.QuotaDTO, error) {
	return []quota.QuotaDTO{}, nil
}

func (f *FakeQuotaService) Update(ctx context.Context, cmd *quota.UpdateQuotaCmd) error {
	return nil
}

func (f *FakeQuotaService) QuotaReached(c *models.ReqContext, target string) (bool, error) {
	return f.reached, f.err
}

func (f *FakeQuotaService) CheckQuotaReached(c context.Context, target string, params *quota.ScopeParameters) (bool, error) {
	return f.reached, f.err
}

func (f *FakeQuotaService) DeleteByUser(c context.Context, userID int64) error {
	return f.err
}

func (f *FakeQuotaService) AddReporter(_ context.Context, e *quota.NewQuotaReporter) error {
	return f.err
}

type FakeQuotaStore struct {
	ExpectedError error
}

func (f *FakeQuotaStore) DeleteByUser(ctx context.Context, userID int64) error {
	return f.ExpectedError
}

func (f *FakeQuotaStore) Get(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	return nil, f.ExpectedError
}

func (f *FakeQuotaStore) Update(ctx context.Context, cmd *quota.UpdateQuotaCmd) error {
	return f.ExpectedError
}
