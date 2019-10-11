package checkers

import (
	"go/ast"

	"github.com/go-critic/go-critic/checkers/internal/lintutil"
	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
	"github.com/go-toolsmith/astcast"
	"golang.org/x/tools/go/ast/astutil"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "newDeref"
	info.Tags = []string{"style", "experimental"}
	info.Summary = "Detects immediate dereferencing of `new` expressions"
	info.Before = `x := *new(bool)`
	info.After = `x := false`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForExpr(&newDerefChecker{ctx: ctx})
	})
}

type newDerefChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *newDerefChecker) VisitExpr(expr ast.Expr) {
	deref := astcast.ToStarExpr(expr)
	call := astcast.ToCallExpr(deref.X)
	if astcast.ToIdent(call.Fun).Name == "new" {
		typ := c.ctx.TypesInfo.TypeOf(call.Args[0])
		zv := lintutil.ZeroValueOf(astutil.Unparen(call.Args[0]), typ)
		if zv != nil {
			c.warn(expr, zv)
		}
	}
}

func (c *newDerefChecker) warn(cause, suggestion ast.Expr) {
	c.ctx.Warn(cause, "replace `%s` with `%s`", cause, suggestion)
}
