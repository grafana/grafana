package quota

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type Service interface {
	QuotaReached(c *models.ReqContext, target string) (bool, error)
	CheckQuotaReached(ctx context.Context, target string, scopeParams *ScopeParameters) (bool, error)
	DeleteByUser(context.Context, int64) error
}
