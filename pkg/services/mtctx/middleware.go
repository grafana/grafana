package mtctx

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

type tenantInfoKey struct{}

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
		return nil, fmt.Errorf("seesion not found")
	}
	return c, nil
}
