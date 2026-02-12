package dualwrite

import (
	"context"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

type ctxKey struct{}

type dualWriteContext struct {
	updatedSecureValues common.InlineSecureValues
}

func addToContext(ctx context.Context) context.Context {
	return context.WithValue(ctx, ctxKey{}, &dualWriteContext{})
}

// Get the Requester from context
func SetUpdatedSecureValues(ctx context.Context, sv common.InlineSecureValues) {
	u, ok := ctx.Value(ctxKey{}).(*dualWriteContext)
	if !ok || u == nil {
		return // OK, this can happen when things are in mode 0 (legacy only)
	}
	u.updatedSecureValues = sv
}

// Get the Requester from context
func getUpdatedSecureValues(ctx context.Context) common.InlineSecureValues {
	u, ok := ctx.Value(ctxKey{}).(*dualWriteContext)
	if !ok || u == nil {
		return nil
	}
	return u.updatedSecureValues
}
