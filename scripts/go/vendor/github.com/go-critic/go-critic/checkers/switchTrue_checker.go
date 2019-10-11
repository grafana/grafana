package checkers

import (
	"go/ast"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "switchTrue"
	info.Tags = []string{"style"}
	info.Summary = "Detects switch-over-bool statements that use explicit `true` tag value"
	info.Before = `
switch true {
case x > y:
}`
	info.After = `
switch {
case x > y:
}`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForStmt(&switchTrueChecker{ctx: ctx})
	})
}

type switchTrueChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *switchTrueChecker) VisitStmt(stmt ast.Stmt) {
	if stmt, ok := stmt.(*ast.SwitchStmt); ok {
		if qualifiedName(stmt.Tag) == "true" {
			c.warn(stmt)
		}
	}
}

func (c *switchTrueChecker) warn(cause *ast.SwitchStmt) {
	if cause.Init == nil {
		c.ctx.Warn(cause, "replace 'switch true {}' with 'switch {}'")
	} else {
		c.ctx.Warn(cause, "replace 'switch %s; true {}' with 'switch %s; {}'",
			cause.Init, cause.Init)
	}
}
