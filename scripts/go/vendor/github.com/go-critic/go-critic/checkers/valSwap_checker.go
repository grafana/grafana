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
	info.Name = "valSwap"
	info.Tags = []string{"style", "experimental"}
	info.Summary = "Detects value swapping code that are not using parallel assignment"
	info.Before = `
tmp := *x
*x = *y
*y = tmp`
	info.After = `*x, *y = *y, *x`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForStmtList(&valSwapChecker{ctx: ctx})
	})
}

type valSwapChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *valSwapChecker) VisitStmtList(list []ast.Stmt) {
	for len(list) >= 3 {
		tmpAssign := astcast.ToAssignStmt(list[0])
		assignX := astcast.ToAssignStmt(list[1])
		assignY := astcast.ToAssignStmt(list[2])

		cond := c.isSimpleAssign(tmpAssign) &&
			c.isSimpleAssign(assignX) &&
			c.isSimpleAssign(assignY) &&
			assignX.Tok == token.ASSIGN &&
			assignY.Tok == token.ASSIGN &&
			astequal.Expr(assignX.Lhs[0], tmpAssign.Rhs[0]) &&
			astequal.Expr(assignX.Rhs[0], assignY.Lhs[0]) &&
			astequal.Expr(assignY.Rhs[0], tmpAssign.Lhs[0])
		if cond {
			c.warn(tmpAssign, assignX.Lhs[0], assignY.Lhs[0])
			list = list[3:]
		} else {
			list = list[1:]
		}
	}
}

func (c *valSwapChecker) isSimpleAssign(x *ast.AssignStmt) bool {
	return len(x.Lhs) == 1 && len(x.Rhs) == 1
}

func (c *valSwapChecker) warn(cause, x, y ast.Node) {
	c.ctx.Warn(cause, "can re-write as `%s, %s = %s, %s`",
		x, y, y, x)
}
