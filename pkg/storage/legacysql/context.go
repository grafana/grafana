package legacysql

import (
	"context"
)

type LegacyIDAccess struct {
	ID int64
}

type accessKey struct{}

// WithRequester attaches the requester to the context.
func WithLegacyIDAccess(ctx context.Context) context.Context {
	return context.WithValue(ctx, accessKey{}, &LegacyIDAccess{})
}

func GetLegacyIDAccess(ctx context.Context) *LegacyIDAccess {
	v, _ := ctx.Value(accessKey{}).(*LegacyIDAccess)
	return v
}
