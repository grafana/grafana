package auth

import (
	"context"

	"github.com/grafana/grafana/pkg/services/quota"
)

const (
	QuotaTargetSrv quota.TargetSrv = "auth"
	QuotaTarget    quota.Target    = "session"
)

type ActiveTokenService interface {
	ActiveTokenCount(ctx context.Context, _ *quota.ScopeParameters) (*quota.Map, error)
}
