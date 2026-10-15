package navtreeimpl

import (
	"bytes"
	"context"
	"strconv"
	"text/template"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/plugins"
)

// evaluateAvailable resolves an include's availability for this request.
// An omitted value is visible.
func evaluateAvailable(ctx context.Context, expr *plugins.FlagExpr) (visible bool) {
	if expr == nil {
		return true
	}
	if expr.Static != nil {
		return *expr.Static
	}
	if expr.Template == nil {
		return true
	}

	// Fail open on panic: Execute re-panics on runtime errors from the bound flag function.
	visible = true
	defer func() {
		if recover() != nil {
			visible = true
		}
	}()

	// Clone before rebinding: the manifest template is shared across requests,
	// so mutating it could race or reuse another request's context.
	evalTmpl, err := expr.Template.Clone()
	if err != nil {
		return true
	}

	client := openfeature.NewDefaultClient()
	evalTmpl = evalTmpl.Funcs(template.FuncMap{
		"flag": func(key string, fallback bool) bool {
			return client.Boolean(ctx, key, fallback, openfeature.TransactionContext(ctx))
		},
	})

	var buf bytes.Buffer
	if err := evalTmpl.Execute(&buf, nil); err != nil {
		return true
	}

	result, err := strconv.ParseBool(buf.String())
	if err != nil {
		return true
	}
	visible = result
	return visible
}
