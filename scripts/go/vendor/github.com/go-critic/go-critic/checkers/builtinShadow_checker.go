package checkers

import (
	"go/ast"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "builtinShadow"
	info.Tags = []string{"style", "opinionated"}
	info.Summary = "Detects when predeclared identifiers shadowed in assignments"
	info.Before = `len := 10`
	info.After = `length := 10`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForLocalDef(&builtinShadowChecker{ctx: ctx}, ctx.TypesInfo)
	})
}

type builtinShadowChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *builtinShadowChecker) VisitLocalDef(name astwalk.Name, _ ast.Expr) {
	if isBuiltin(name.ID.Name) {
		c.warn(name.ID)
	}
}

func (c *builtinShadowChecker) warn(ident *ast.Ident) {
	c.ctx.Warn(ident, "shadowing of predeclared identifier: %s", ident)
}
