package legacy

import (
	"context"

	"github.com/grafana/grafana/pkg/apis/dashboard"
)

type LegacyValue struct {
	Dashboard *dashboard.Dashboard
}

type accessKey struct{}

// WithRequester attaches the requester to the context.
func WithLegacyAccess(ctx context.Context) context.Context {
	return context.WithValue(ctx, accessKey{}, &LegacyValue{})
}

func GetLegacyAccess(ctx context.Context) *LegacyValue {
	v, _ := ctx.Value(accessKey{}).(*LegacyValue)
	return v // nil if missing
}
