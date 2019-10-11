package checkers

import (
	"go/ast"
	"strings"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
	"github.com/go-toolsmith/astp"
	"golang.org/x/tools/go/ast/astutil"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "regexpMust"
	info.Tags = []string{"style"}
	info.Summary = "Detects `regexp.Compile*` that can be replaced with `regexp.MustCompile*`"
	info.Before = `re, _ := regexp.Compile("const pattern")`
	info.After = `re := regexp.MustCompile("const pattern")`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForExpr(&regexpMustChecker{ctx: ctx})
	})
}

type regexpMustChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *regexpMustChecker) VisitExpr(x ast.Expr) {
	if x, ok := x.(*ast.CallExpr); ok {
		switch name := qualifiedName(x.Fun); name {
		case "regexp.Compile", "regexp.CompilePOSIX":
			// Only check for trivial string args, permit parenthesis.
			if !astp.IsBasicLit(astutil.Unparen(x.Args[0])) {
				return
			}
			c.warn(x, strings.Replace(name, "Compile", "MustCompile", 1))
		}
	}
}

func (c *regexpMustChecker) warn(cause *ast.CallExpr, suggestion string) {
	c.ctx.Warn(cause, "for const patterns like %s, use %s",
		cause.Args[0], suggestion)
}
