package mtctx

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

type tenantInfoKey struct{}

var (
	ErrTenantInfoMissing = errors.New("missing tenant info")
)

type TenantInfo struct {
	StackID   int64
	SessionDB *session.SessionDB
}

func ContextWithTenantInfo(ctx context.Context, data *TenantInfo) context.Context {
	return context.WithValue(ctx, tenantInfoKey{}, data)
}

func TenantInfoFromContext(ctx context.Context) (*TenantInfo, error) {
	c, ok := ctx.Value(tenantInfoKey{}).(*TenantInfo)
	if !ok || c == nil {
		return nil, ErrTenantInfoMissing
	}
	return c, nil
}
