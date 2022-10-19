package quota

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type Service interface {
	Get(ctx context.Context, scope string, id int64) ([]QuotaDTO, error)
	Update(ctx context.Context, cmd *UpdateQuotaCmd) error
	QuotaReached(c *models.ReqContext, target string) (bool, error)
	CheckQuotaReached(ctx context.Context, target string, scopeParams *ScopeParameters) (bool, error)
	DeleteByUser(ctx context.Context, userID int64) error
}

type UsageReporterFunc func(ctx context.Context, scopeParams *ScopeParameters) (*Map, error)
