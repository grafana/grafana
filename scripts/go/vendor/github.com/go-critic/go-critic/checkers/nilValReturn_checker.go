package checkers

import (
	"go/ast"
	"go/token"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
	"github.com/go-toolsmith/astequal"
	"github.com/go-toolsmith/typep"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "nilValReturn"
	info.Tags = []string{"diagnostic", "experimental"}
	info.Summary = "Detects return statements those results evaluate to nil"
	info.Before = `
if err == nil {
	return err
}`
	info.After = `
// (A) - return nil explicitly
if err == nil {
	return nil
}
// (B) - typo in "==", change to "!="
if err != nil {
	return err
}`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForStmt(&nilValReturnChecker{ctx: ctx})
	})
}

type nilValReturnChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *nilValReturnChecker) VisitStmt(stmt ast.Stmt) {
	ifStmt, ok := stmt.(*ast.IfStmt)
	if !ok || len(ifStmt.Body.List) != 1 {
		return
	}
	ret, ok := ifStmt.Body.List[0].(*ast.ReturnStmt)
	if !ok || len(ret.Results) != 1 {
		return
	}
	expr, ok := ifStmt.Cond.(*ast.BinaryExpr)
	cond := ok &&
		expr.Op == token.EQL &&
		typep.SideEffectFree(c.ctx.TypesInfo, expr.X) &&
		qualifiedName(expr.Y) == "nil" &&
		astequal.Expr(expr.X, ret.Results[0])
	if cond {
		c.warn(ret, expr.X)
	}
}

func (c *nilValReturnChecker) warn(cause, val ast.Node) {
	c.ctx.Warn(cause, "returned expr is always nil; replace %s with nil", val)
}
