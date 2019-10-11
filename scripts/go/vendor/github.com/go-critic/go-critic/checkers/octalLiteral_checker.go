package checkers

import (
	"go/ast"
	"go/token"
	"go/types"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
	"github.com/go-toolsmith/astcast"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "octalLiteral"
	info.Tags = []string{"diagnostic", "experimental"}
	info.Summary = "Detects octal literals passed to functions"
	info.Before = `foo(02)`
	info.After = `foo(2)`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		c := &octalLiteralChecker{
			ctx: ctx,
			octFriendlyPkg: map[string]bool{
				"os":        true,
				"io/ioutil": true,
			},
		}
		return astwalk.WalkerForExpr(c)
	})
}

type octalLiteralChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext

	octFriendlyPkg map[string]bool
}

func (c *octalLiteralChecker) VisitExpr(expr ast.Expr) {
	call := astcast.ToCallExpr(expr)
	calledExpr := astcast.ToSelectorExpr(call.Fun)
	ident := astcast.ToIdent(calledExpr.X)

	if obj, ok := c.ctx.TypesInfo.ObjectOf(ident).(*types.PkgName); ok {
		pkg := obj.Imported()
		if c.octFriendlyPkg[pkg.Path()] {
			return
		}
	}

	for _, arg := range call.Args {
		if lit := astcast.ToBasicLit(c.unsign(arg)); len(lit.Value) > 1 &&
			c.isIntLiteral(lit) &&
			c.isOctalLiteral(lit) {
			c.warn(call)
			return
		}
	}
}

func (c *octalLiteralChecker) unsign(e ast.Expr) ast.Expr {
	u, ok := e.(*ast.UnaryExpr)
	if !ok {
		return e
	}
	return u.X
}

func (c *octalLiteralChecker) isIntLiteral(lit *ast.BasicLit) bool {
	return lit.Kind == token.INT
}

func (c *octalLiteralChecker) isOctalLiteral(lit *ast.BasicLit) bool {
	return lit.Value[0] == '0' &&
		lit.Value[1] != 'x' &&
		lit.Value[1] != 'X'
}

func (c *octalLiteralChecker) warn(expr ast.Expr) {
	c.ctx.Warn(expr, "suspicious octal args in `%s`", expr)
}
