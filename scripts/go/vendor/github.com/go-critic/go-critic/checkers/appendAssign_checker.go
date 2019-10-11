package checkers

import (
	"go/ast"
	"go/token"
	"go/types"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
	"github.com/go-toolsmith/astequal"
	"github.com/go-toolsmith/astp"
	"golang.org/x/tools/go/ast/astutil"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "appendAssign"
	info.Tags = []string{"diagnostic"}
	info.Summary = "Detects suspicious append result assignments"
	info.Before = `
p.positives = append(p.negatives, x)
p.negatives = append(p.negatives, y)`
	info.After = `
p.positives = append(p.positives, x)
p.negatives = append(p.negatives, y)`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForStmt(&appendAssignChecker{ctx: ctx})
	})
}

type appendAssignChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *appendAssignChecker) VisitStmt(stmt ast.Stmt) {
	assign, ok := stmt.(*ast.AssignStmt)
	if !ok || assign.Tok != token.ASSIGN || len(assign.Lhs) != len(assign.Rhs) {
		return
	}
	for i, rhs := range assign.Rhs {
		call, ok := rhs.(*ast.CallExpr)
		if !ok || qualifiedName(call.Fun) != "append" {
			continue
		}
		c.checkAppend(assign.Lhs[i], call)
	}
}

func (c *appendAssignChecker) checkAppend(x ast.Expr, call *ast.CallExpr) {
	if call.Ellipsis != token.NoPos {
		// Try to detect `xs = append(ys, xs...)` idiom.
		for _, arg := range call.Args[1:] {
			y := arg
			if arg, ok := arg.(*ast.SliceExpr); ok {
				y = arg.X
			}
			if astequal.Expr(x, y) {
				return
			}
		}
	}

	switch x := x.(type) {
	case *ast.Ident:
		if x.Name == "_" {
			return // Don't check assignments to blank ident
		}
	case *ast.IndexExpr:
		if !astp.IsIndexExpr(call.Args[0]) {
			// Most likely `m[k] = append(x, ...)`
			// pattern, where x was retrieved by m[k] before.
			//
			// TODO: it's possible to record such map/slice reads
			// and check whether it was done before this call.
			// But for now, treat it like x belongs to m[k].
			return
		}
	}

	switch y := call.Args[0].(type) {
	case *ast.SliceExpr:
		if _, ok := c.ctx.TypesInfo.TypeOf(y.X).(*types.Array); ok {
			// Arrays are frequently used as scratch storages.
			return
		}
		c.matchSlices(call, x, y.X)
	case *ast.IndexExpr, *ast.Ident, *ast.SelectorExpr:
		c.matchSlices(call, x, y)
	}
}

func (c *appendAssignChecker) matchSlices(cause ast.Node, x, y ast.Expr) {
	if !astequal.Expr(x, astutil.Unparen(y)) {
		c.warn(cause)
	}
}

func (c *appendAssignChecker) warn(cause ast.Node) {
	c.ctx.Warn(cause, "append result not assigned to the same slice")
}
