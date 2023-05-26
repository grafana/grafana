package quotatest

import (
	"context"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/quota"
)

type FakeQuotaService struct {
	reached bool
	err     error
}

func New(reached bool, err error) *FakeQuotaService {
	return &FakeQuotaService{reached, err}
}

func (f *FakeQuotaService) GetQuotasByScope(ctx context.Context, scope quota.Scope, id int64) ([]quota.QuotaDTO, error) {
	return []quota.QuotaDTO{}, nil
}

func (f *FakeQuotaService) Update(ctx context.Context, cmd *quota.UpdateQuotaCmd) error {
	return nil
}

func (f *FakeQuotaService) QuotaReached(c *contextmodel.ReqContext, target quota.TargetSrv) (bool, error) {
	return f.reached, f.err
}

func (f *FakeQuotaService) CheckQuotaReached(c context.Context, target quota.TargetSrv, params *quota.ScopeParameters) (bool, error) {
	return f.reached, f.err
}

func (f *FakeQuotaService) DeleteQuotaForUser(c context.Context, userID int64) error {
	return f.err
}

func (f *FakeQuotaService) RegisterQuotaReporter(e *quota.NewUsageReporter) error {
	return f.err
}

type FakeQuotaStore struct {
	ExpectedError error
}

func (f *FakeQuotaStore) DeleteByUser(ctx quota.Context, userID int64) error {
	return f.ExpectedError
}

func (f *FakeQuotaStore) Get(ctx quota.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	return nil, f.ExpectedError
}

func (f *FakeQuotaStore) Update(ctx quota.Context, cmd *quota.UpdateQuotaCmd) error {
	return f.ExpectedError
}
