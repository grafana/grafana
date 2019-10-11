package checkers

import (
	"go/ast"
	"go/constant"
	"go/types"
	"strings"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
	"github.com/go-toolsmith/astcast"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "flagName"
	info.Tags = []string{"diagnostic", "experimental"}
	info.Summary = "Detects flag names with whitespace"
	info.Before = `b := flag.Bool(" foo ", false, "description")`
	info.After = `b := flag.Bool("foo", false, "description")`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForExpr(&flagNameChecker{ctx: ctx})
	})
}

type flagNameChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *flagNameChecker) VisitExpr(expr ast.Expr) {
	call := astcast.ToCallExpr(expr)
	calledExpr := astcast.ToSelectorExpr(call.Fun)
	obj, ok := c.ctx.TypesInfo.ObjectOf(astcast.ToIdent(calledExpr.X)).(*types.PkgName)
	if !ok {
		return
	}
	sym := calledExpr.Sel
	pkg := obj.Imported()
	if pkg.Path() != "flag" {
		return
	}

	switch sym.Name {
	case "Bool", "Duration", "Float64", "String",
		"Int", "Int64", "Uint", "Uint64":
		c.checkFlagName(call, call.Args[0])
	case "BoolVar", "DurationVar", "Float64Var", "StringVar",
		"IntVar", "Int64Var", "UintVar", "Uint64Var":
		c.checkFlagName(call, call.Args[1])
	}
}

func (c *flagNameChecker) checkFlagName(call *ast.CallExpr, arg ast.Expr) {
	cv := c.ctx.TypesInfo.Types[arg].Value
	if cv == nil {
		return // Non-constant name
	}
	name := constant.StringVal(cv)
	if strings.Contains(name, " ") {
		c.warnWhitespace(call, name)
	}
}

func (c *flagNameChecker) warnWhitespace(cause ast.Node, name string) {
	c.ctx.Warn(cause, "flag name %q contains whitespace", name)
}
