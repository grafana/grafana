package checkers

import (
	"go/ast"

	"github.com/go-critic/go-critic/checkers/internal/lintutil"
	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "dupCase"
	info.Tags = []string{"diagnostic"}
	info.Summary = "Detects duplicated case clauses inside switch statements"
	info.Before = `
switch x {
case ys[0], ys[1], ys[2], ys[0], ys[4]:
}`
	info.After = `
switch x {
case ys[0], ys[1], ys[2], ys[3], ys[4]:
}`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForStmt(&dupCaseChecker{ctx: ctx})
	})
}

type dupCaseChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext

	astSet lintutil.AstSet
}

func (c *dupCaseChecker) VisitStmt(stmt ast.Stmt) {
	if stmt, ok := stmt.(*ast.SwitchStmt); ok {
		c.checkSwitch(stmt)
	}
}

func (c *dupCaseChecker) checkSwitch(stmt *ast.SwitchStmt) {
	c.astSet.Clear()
	for i := range stmt.Body.List {
		cc := stmt.Body.List[i].(*ast.CaseClause)
		for _, x := range cc.List {
			if !c.astSet.Insert(x) {
				c.warn(x)
			}
		}
	}
}

func (c *dupCaseChecker) warn(cause ast.Node) {
	c.ctx.Warn(cause, "'case %s' is duplicated", cause)
}
