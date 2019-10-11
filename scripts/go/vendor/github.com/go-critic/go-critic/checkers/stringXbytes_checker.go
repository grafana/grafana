package checkers

import (
	"go/ast"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
	"github.com/go-toolsmith/typep"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "stringXbytes"
	info.Tags = []string{"style", "experimental"}
	info.Summary = "Detects redundant conversions between string and []byte"
	info.Before = `copy(b, []byte(s))`
	info.After = `copy(b, s)`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForExpr(&stringXbytes{ctx: ctx})
	})
}

type stringXbytes struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *stringXbytes) VisitExpr(expr ast.Expr) {
	x, ok := expr.(*ast.CallExpr)
	if !ok || qualifiedName(x.Fun) != "copy" {
		return
	}

	src := x.Args[1]

	byteCast, ok := src.(*ast.CallExpr)
	if ok && typep.IsTypeExpr(c.ctx.TypesInfo, byteCast.Fun) &&
		typep.HasStringProp(c.ctx.TypesInfo.TypeOf(byteCast.Args[0])) {

		c.warn(byteCast, byteCast.Args[0])
	}
}

func (c *stringXbytes) warn(cause *ast.CallExpr, suggestion ast.Expr) {
	c.ctx.Warn(cause, "can simplify `%s` to `%s`", cause, suggestion)
}
