package navtreeimpl

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/plugins"
)

// evaluateAvailable resolves an include's availability for this request.
// An omitted value is available.
func evaluateAvailable(ctx context.Context, expr *plugins.FlagExpr) (available bool) {
	if expr == nil {
		return true
	}
	if expr.Static != nil {
		return *expr.Static
	}
	if expr.Flag == nil {
		return true
	}

	// Fail open on panic: a nil context (or any other client-internal bug) can
	// panic here, independent of expr.Fallback, which only covers the flag
	// genuinely not resolving.
	available = true
	defer func() {
		if recover() != nil {
			available = true
		}
	}()

	client := openfeature.NewDefaultClient()
	available = client.Boolean(ctx, *expr.Flag, expr.Fallback, openfeature.TransactionContext(ctx))
	return available
}
