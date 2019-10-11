package checkers

import (
	"go/ast"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
	"github.com/go-toolsmith/astfmt"
	"github.com/go-toolsmith/astp"
	"golang.org/x/tools/go/ast/astutil"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "exitAfterDefer"
	info.Tags = []string{"diagnostic", "experimental"}
	info.Summary = "Detects calls to exit/fatal inside functions that use defer"
	info.Before = `
defer os.Remove(filename)
if bad {
	log.Fatalf("something bad happened")
}`
	info.After = `
defer os.Remove(filename)
if bad {
	log.Printf("something bad happened")
	return
}`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForFuncDecl(&exitAfterDeferChecker{ctx: ctx})
	})
}

type exitAfterDeferChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *exitAfterDeferChecker) VisitFuncDecl(fn *ast.FuncDecl) {
	// TODO(Quasilyte): handle goto and other kinds of flow that break
	// the algorithm below that expects the latter statement to be
	// executed after the ones that come before it.

	var deferStmt *ast.DeferStmt
	pre := func(cur *astutil.Cursor) bool {
		// Don't recurse into local anonymous functions.
		return !astp.IsFuncLit(cur.Node())
	}
	post := func(cur *astutil.Cursor) bool {
		switch n := cur.Node().(type) {
		case *ast.DeferStmt:
			deferStmt = n
		case *ast.CallExpr:
			if deferStmt != nil {
				switch qualifiedName(n.Fun) {
				case "log.Fatal", "log.Fatalf", "log.Fatalln", "os.Exit":
					c.warn(n, deferStmt)
					return false
				}
			}
		}
		return true
	}
	astutil.Apply(fn.Body, pre, post)
}

func (c *exitAfterDeferChecker) warn(cause *ast.CallExpr, deferStmt *ast.DeferStmt) {
	var s string
	if fnlit, ok := deferStmt.Call.Fun.(*ast.FuncLit); ok {
		// To avoid long and multi-line warning messages,
		// collapse the function literals.
		s = "defer " + astfmt.Sprint(fnlit.Type) + "{...}(...)"
	} else {
		s = astfmt.Sprint(deferStmt)
	}
	c.ctx.Warn(cause, "%s clutters `%s`", cause.Fun, s)
}
