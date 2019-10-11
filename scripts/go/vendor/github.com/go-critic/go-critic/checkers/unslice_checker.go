package checkers

import (
	"go/ast"
	"go/types"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
	"github.com/go-toolsmith/astequal"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "unslice"
	info.Tags = []string{"style"}
	info.Summary = "Detects slice expressions that can be simplified to sliced expression itself"
	info.Before = `
f(s[:])               // s is string
copy(b[:], values...) // b is []byte`
	info.After = `
f(s)
copy(b, values...)`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForExpr(&unsliceChecker{ctx: ctx})
	})
}

type unsliceChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *unsliceChecker) VisitExpr(expr ast.Expr) {
	unsliced := c.unslice(expr)
	if !astequal.Expr(expr, unsliced) {
		c.warn(expr, unsliced)
		c.SkipChilds = true
	}
}

func (c *unsliceChecker) unslice(expr ast.Expr) ast.Expr {
	slice, ok := expr.(*ast.SliceExpr)
	if !ok || slice.Low != nil || slice.High != nil {
		// No need to worry about 3-index slicing,
		// because it's only permitted if expr.High is not nil.
		return expr
	}
	switch c.ctx.TypesInfo.TypeOf(slice.X).(type) {
	case *types.Slice, *types.Basic:
		// Basic kind catches strings, Slice cathes everything else.
		return c.unslice(slice.X)
	}
	return expr
}

func (c *unsliceChecker) warn(cause, unsliced ast.Expr) {
	c.ctx.Warn(cause, "could simplify %s to %s", cause, unsliced)
}
