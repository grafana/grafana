package checkers

import (
	"go/ast"
	"go/token"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "emptyFallthrough"
	info.Tags = []string{"style", "experimental"}
	info.Summary = "Detects fallthrough that can be avoided by using multi case values"
	info.Before = `switch kind {
case reflect.Int:
	fallthrough
case reflect.Int32:
	return Int
}`
	info.After = `switch kind {
case reflect.Int, reflect.Int32:
	return Int
}`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForStmt(&emptyFallthroughChecker{ctx: ctx})
	})
}

type emptyFallthroughChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *emptyFallthroughChecker) VisitStmt(stmt ast.Stmt) {
	ss, ok := stmt.(*ast.SwitchStmt)
	if !ok {
		return
	}

	prevCaseDefault := false
	for i := len(ss.Body.List) - 1; i >= 0; i-- {
		if cc, ok := ss.Body.List[i].(*ast.CaseClause); ok {
			warn := false
			if len(cc.Body) == 1 {
				if bs, ok := cc.Body[0].(*ast.BranchStmt); ok && bs.Tok == token.FALLTHROUGH {
					warn = true
					if prevCaseDefault {
						c.warnDefault(bs)
					} else {
						c.warn(bs)
					}
				}
			}
			if !warn {
				prevCaseDefault = cc.List == nil
			}
		}
	}
}

func (c *emptyFallthroughChecker) warnDefault(cause ast.Node) {
	c.ctx.Warn(cause, "remove empty case containing only fallthrough to default case")
}

func (c *emptyFallthroughChecker) warn(cause ast.Node) {
	c.ctx.Warn(cause, "replace empty case containing only fallthrough with expression list")
}
