package checkers

import (
	"go/ast"
	"go/token"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
	"github.com/go-toolsmith/astcopy"
	"github.com/go-toolsmith/astequal"
	"github.com/go-toolsmith/typep"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "assignOp"
	info.Tags = []string{"style"}
	info.Summary = "Detects assignments that can be simplified by using assignment operators"
	info.Before = `x = x * 2`
	info.After = `x *= 2`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForStmt(&assignOpChecker{ctx: ctx})
	})
}

type assignOpChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *assignOpChecker) VisitStmt(stmt ast.Stmt) {
	assign, ok := stmt.(*ast.AssignStmt)
	cond := ok &&
		assign.Tok == token.ASSIGN &&
		len(assign.Lhs) == 1 &&
		len(assign.Rhs) == 1 &&
		typep.SideEffectFree(c.ctx.TypesInfo, assign.Lhs[0])
	if !cond {
		return
	}

	// TODO(quasilyte): can take commutativity into account.
	expr, ok := assign.Rhs[0].(*ast.BinaryExpr)
	if !ok || !astequal.Expr(assign.Lhs[0], expr.X) {
		return
	}

	// TODO(quasilyte): perform unparen?
	switch expr.Op {
	case token.MUL:
		c.warn(assign, token.MUL_ASSIGN, expr.Y)
	case token.QUO:
		c.warn(assign, token.QUO_ASSIGN, expr.Y)
	case token.REM:
		c.warn(assign, token.REM_ASSIGN, expr.Y)
	case token.ADD:
		c.warn(assign, token.ADD_ASSIGN, expr.Y)
	case token.SUB:
		c.warn(assign, token.SUB_ASSIGN, expr.Y)
	case token.AND:
		c.warn(assign, token.AND_ASSIGN, expr.Y)
	case token.OR:
		c.warn(assign, token.OR_ASSIGN, expr.Y)
	case token.XOR:
		c.warn(assign, token.XOR_ASSIGN, expr.Y)
	case token.SHL:
		c.warn(assign, token.SHL_ASSIGN, expr.Y)
	case token.SHR:
		c.warn(assign, token.SHR_ASSIGN, expr.Y)
	case token.AND_NOT:
		c.warn(assign, token.AND_NOT_ASSIGN, expr.Y)
	}
}

func (c *assignOpChecker) warn(cause *ast.AssignStmt, op token.Token, rhs ast.Expr) {
	suggestion := c.simplify(cause, op, rhs)
	c.ctx.Warn(cause, "replace `%s` with `%s`", cause, suggestion)
}

func (c *assignOpChecker) simplify(cause *ast.AssignStmt, op token.Token, rhs ast.Expr) ast.Stmt {
	if lit, ok := rhs.(*ast.BasicLit); ok && lit.Kind == token.INT && lit.Value == "1" {
		switch op {
		case token.ADD_ASSIGN:
			return &ast.IncDecStmt{
				X:      cause.Lhs[0],
				TokPos: cause.TokPos,
				Tok:    token.INC,
			}
		case token.SUB_ASSIGN:
			return &ast.IncDecStmt{
				X:      cause.Lhs[0],
				TokPos: cause.TokPos,
				Tok:    token.DEC,
			}
		}
	}
	suggestion := astcopy.AssignStmt(cause)
	suggestion.Tok = op
	suggestion.Rhs[0] = rhs
	return suggestion
}
