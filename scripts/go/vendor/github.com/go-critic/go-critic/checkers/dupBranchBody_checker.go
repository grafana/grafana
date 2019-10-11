package checkers

import (
	"go/ast"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
	"github.com/go-toolsmith/astequal"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "dupBranchBody"
	info.Tags = []string{"diagnostic"}
	info.Summary = "Detects duplicated branch bodies inside conditional statements"
	info.Before = `
if cond {
	println("cond=true")
} else {
	println("cond=true")
}`
	info.After = `
if cond {
	println("cond=true")
} else {
	println("cond=false")
}`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForStmt(&dupBranchBodyChecker{ctx: ctx})
	})
}

type dupBranchBodyChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *dupBranchBodyChecker) VisitStmt(stmt ast.Stmt) {
	// TODO(quasilyte): extend to check switch statements as well.
	// Should be very careful with type switches.

	if stmt, ok := stmt.(*ast.IfStmt); ok {
		c.checkIf(stmt)
	}
}

func (c *dupBranchBodyChecker) checkIf(stmt *ast.IfStmt) {
	thenBody := stmt.Body
	elseBody, ok := stmt.Else.(*ast.BlockStmt)
	if ok && astequal.Stmt(thenBody, elseBody) {
		c.warnIf(stmt)
	}
}

func (c *dupBranchBodyChecker) warnIf(cause ast.Node) {
	c.ctx.Warn(cause, "both branches in if statement has same body")
}
