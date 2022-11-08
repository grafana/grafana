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

func NewQuotaServiceFake() *FakeQuotaService {
	return &FakeQuotaService{}
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
