package checkers

import (
	"go/ast"
	"go/types"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
	"github.com/go-toolsmith/astcast"
	"github.com/go-toolsmith/astequal"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "unlambda"
	info.Tags = []string{"style"}
	info.Summary = "Detects function literals that can be simplified"
	info.Before = `func(x int) int { return fn(x) }`
	info.After = `fn`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForExpr(&unlambdaChecker{ctx: ctx})
	})
}

type unlambdaChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *unlambdaChecker) VisitExpr(x ast.Expr) {
	fn, ok := x.(*ast.FuncLit)
	if !ok || len(fn.Body.List) != 1 {
		return
	}

	ret, ok := fn.Body.List[0].(*ast.ReturnStmt)
	if !ok || len(ret.Results) != 1 {
		return
	}

	result := astcast.ToCallExpr(ret.Results[0])
	callable := qualifiedName(result.Fun)
	if callable == "" {
		return // Skip tricky cases; only handle simple calls
	}
	if isBuiltin(callable) {
		return // See #762
	}
	fnType := c.ctx.TypesInfo.TypeOf(fn)
	resultType := c.ctx.TypesInfo.TypeOf(result.Fun)
	if !types.Identical(fnType, resultType) {
		return
	}
	// Now check that all arguments match the parameters.
	n := 0
	for _, params := range fn.Type.Params.List {
		for _, id := range params.Names {
			if !astequal.Expr(id, result.Args[n]) {
				return
			}
			n++
		}
	}

	if len(result.Args) == n {
		c.warn(fn, callable)
	}
}

func (c *unlambdaChecker) warn(cause ast.Node, suggestion string) {
	c.ctx.Warn(cause, "replace `%s` with `%s`", cause, suggestion)
}
