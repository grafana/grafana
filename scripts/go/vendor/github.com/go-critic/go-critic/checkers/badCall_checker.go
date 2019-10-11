package checkers

import (
	"go/ast"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
	"github.com/go-toolsmith/astcast"
	"github.com/go-toolsmith/astcopy"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "badCall"
	info.Tags = []string{"diagnostic", "experimental"}
	info.Summary = "Detects suspicious function calls"
	info.Before = `strings.Replace(s, from, to, 0)`
	info.After = `strings.Replace(s, from, to, -1)`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForExpr(&badCallChecker{ctx: ctx})
	})
}

type badCallChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *badCallChecker) VisitExpr(expr ast.Expr) {
	call := astcast.ToCallExpr(expr)
	if len(call.Args) == 0 {
		return
	}

	// TODO(quasilyte): handle methods.

	switch qualifiedName(call.Fun) {
	case "strings.Replace", "bytes.Replace":
		if n := astcast.ToBasicLit(call.Args[3]); n.Value == "0" {
			c.warnBadArg(n, "-1")
		}
	case "strings.SplitN", "bytes.SplitN":
		if n := astcast.ToBasicLit(call.Args[2]); n.Value == "0" {
			c.warnBadArg(n, "-1")
		}
	case "append":
		if len(call.Args) == 1 {
			c.warnAppend(call)
		}
	}
}

func (c *badCallChecker) warnBadArg(badArg *ast.BasicLit, correction string) {
	goodArg := astcopy.BasicLit(badArg)
	goodArg.Value = correction
	c.ctx.Warn(badArg, "suspicious arg %s, probably meant %s",
		badArg, goodArg)
}

func (c *badCallChecker) warnAppend(call *ast.CallExpr) {
	c.ctx.Warn(call, "no-op append call, probably missing arguments")
}
