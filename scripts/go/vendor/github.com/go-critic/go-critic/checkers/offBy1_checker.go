package checkers

import (
	"go/ast"
	"go/token"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
	"github.com/go-toolsmith/astcast"
	"github.com/go-toolsmith/astcopy"
	"github.com/go-toolsmith/astequal"
	"github.com/go-toolsmith/typep"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "offBy1"
	info.Tags = []string{"diagnostic", "experimental"}
	info.Summary = "Detects various off-by-one kind of errors"
	info.Before = `xs[len(xs)]`
	info.After = `xs[len(xs)-1]`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForExpr(&offBy1Checker{ctx: ctx})
	})
}

type offBy1Checker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *offBy1Checker) VisitExpr(e ast.Expr) {
	// TODO(Quasilyte): handle more off-by-1 patterns.
	// TODO(Quasilyte): check whether go/analysis can help here.

	// Detect s[len(s)] expressions that always panic.
	// The correct form is s[len(s)-1].

	indexExpr := astcast.ToIndexExpr(e)
	indexed := indexExpr.X
	if !typep.IsSlice(c.ctx.TypesInfo.TypeOf(indexed)) {
		return
	}
	if !typep.SideEffectFree(c.ctx.TypesInfo, indexed) {
		return
	}
	call := astcast.ToCallExpr(indexExpr.Index)
	if astcast.ToIdent(call.Fun).Name != "len" {
		return
	}
	if len(call.Args) != 1 || !astequal.Expr(call.Args[0], indexed) {
		return
	}
	c.warnLenIndex(indexExpr)
}

func (c *offBy1Checker) warnLenIndex(cause *ast.IndexExpr) {
	suggest := astcopy.IndexExpr(cause)
	suggest.Index = &ast.BinaryExpr{
		Op: token.SUB,
		X:  cause.Index,
		Y:  &ast.BasicLit{Value: "1"},
	}
	c.ctx.Warn(cause, "index expr always panics; maybe you wanted %s?", suggest)
}
