package auth

import (
	"context"

	"github.com/grafana/grafana/pkg/services/quota"
)

type ActiveTokenService interface {
	ActiveTokenCount(ctx context.Context, _ *quota.ScopeParameters) (*quota.Map, error)
}
