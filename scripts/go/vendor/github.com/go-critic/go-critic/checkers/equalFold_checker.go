package checkers

import (
	"go/ast"
	"go/token"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
	"github.com/go-toolsmith/astcast"
	"github.com/go-toolsmith/astequal"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "equalFold"
	info.Tags = []string{"performance", "experimental"}
	info.Summary = "Detects unoptimal strings/bytes case-insensitive comparison"
	info.Before = `strings.ToLower(x) == strings.ToLower(y)`
	info.After = `strings.EqualFold(x, y)`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForExpr(&equalFoldChecker{ctx: ctx})
	})
}

type equalFoldChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *equalFoldChecker) VisitExpr(e ast.Expr) {
	switch e := e.(type) {
	case *ast.CallExpr:
		c.checkBytes(e)
	case *ast.BinaryExpr:
		c.checkStrings(e)
	}
}

// uncaseCall simplifies lower(x) or upper(x) to x.
// If no simplification is applied, second return value is false.
func (c *equalFoldChecker) uncaseCall(x ast.Expr, lower, upper string) (ast.Expr, bool) {
	call := astcast.ToCallExpr(x)
	name := qualifiedName(call.Fun)
	if name != lower && name != upper {
		return x, false
	}
	return call.Args[0], true
}

func (c *equalFoldChecker) checkBytes(expr *ast.CallExpr) {
	if qualifiedName(expr.Fun) != "bytes.Equal" {
		return
	}

	x, ok1 := c.uncaseCall(expr.Args[0], "bytes.ToLower", "bytes.ToUpper")
	y, ok2 := c.uncaseCall(expr.Args[1], "bytes.ToLower", "bytes.ToUpper")
	if !ok1 && !ok2 {
		return
	}
	if !astequal.Expr(x, y) {
		c.warnBytes(expr, x, y)
	}
}

func (c *equalFoldChecker) checkStrings(expr *ast.BinaryExpr) {
	if expr.Op != token.EQL && expr.Op != token.NEQ {
		return
	}

	x, ok1 := c.uncaseCall(expr.X, "strings.ToLower", "strings.ToUpper")
	y, ok2 := c.uncaseCall(expr.Y, "strings.ToLower", "strings.ToUpper")
	if !ok1 && !ok2 {
		return
	}
	if !astequal.Expr(x, y) {
		c.warnStrings(expr, x, y)
	}
}

func (c *equalFoldChecker) warnStrings(cause ast.Node, x, y ast.Expr) {
	c.ctx.Warn(cause, "consider replacing with strings.EqualFold(%s, %s)", x, y)
}

func (c *equalFoldChecker) warnBytes(cause ast.Node, x, y ast.Expr) {
	c.ctx.Warn(cause, "consider replacing with bytes.EqualFold(%s, %s)", x, y)
}
