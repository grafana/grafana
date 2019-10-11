package checkers

import (
	"go/ast"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
	"github.com/go-toolsmith/astp"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "elseif"
	info.Tags = []string{"style"}
	info.Params = lintpack.CheckerParams{
		"skipBalanced": {
			Value: true,
			Usage: "whether to skip balanced if-else pairs",
		},
	}
	info.Summary = "Detects else with nested if statement that can be replaced with else-if"
	info.Before = `
if cond1 {
} else {
	if x := cond2; x {
	}
}`
	info.After = `
if cond1 {
} else if x := cond2; x {
}`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		c := &elseifChecker{ctx: ctx}
		c.skipBalanced = info.Params.Bool("skipBalanced")
		return astwalk.WalkerForStmt(c)
	})
}

type elseifChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext

	skipBalanced bool
}

func (c *elseifChecker) VisitStmt(stmt ast.Stmt) {
	if stmt, ok := stmt.(*ast.IfStmt); ok {
		elseBody, ok := stmt.Else.(*ast.BlockStmt)
		if !ok || len(elseBody.List) != 1 {
			return
		}
		innerIfStmt, ok := elseBody.List[0].(*ast.IfStmt)
		if !ok {
			return
		}
		balanced := len(stmt.Body.List) == 1 &&
			astp.IsIfStmt(stmt.Body.List[0])
		if balanced && c.skipBalanced {
			return // Configured to skip balanced statements
		}
		if innerIfStmt.Else != nil {
			return
		}
		c.warn(stmt.Else)
	}
}

func (c *elseifChecker) warn(cause ast.Node) {
	c.ctx.Warn(cause, "can replace 'else {if cond {}}' with 'else if cond {}'")
}
