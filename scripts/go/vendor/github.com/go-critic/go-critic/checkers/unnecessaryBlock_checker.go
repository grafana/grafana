package checkers

import (
	"go/ast"
	"go/token"

	"github.com/go-lintpack/lintpack"
	"github.com/go-lintpack/lintpack/astwalk"
)

func init() {
	var info lintpack.CheckerInfo
	info.Name = "unnecessaryBlock"
	info.Tags = []string{"style", "opinionated", "experimental"}
	info.Summary = "Detects unnecessary braced statement blocks"
	info.Before = `
x := 1
{
	print(x)
}`
	info.After = `
x := 1
print(x)`

	collection.AddChecker(&info, func(ctx *lintpack.CheckerContext) lintpack.FileWalker {
		return astwalk.WalkerForStmtList(&unnecessaryBlockChecker{ctx: ctx})
	})
}

type unnecessaryBlockChecker struct {
	astwalk.WalkHandler
	ctx *lintpack.CheckerContext
}

func (c *unnecessaryBlockChecker) VisitStmtList(statements []ast.Stmt) {
	// Using StmtListVisitor instead of StmtVisitor makes it easier to avoid
	// false positives on IfStmt, RangeStmt, ForStmt and alike.
	// We only inspect BlockStmt inside statement lists, so this method is not
	// called for IfStmt itself, for example.

	for _, stmt := range statements {
		stmt, ok := stmt.(*ast.BlockStmt)
		if ok && !c.hasDefinitions(stmt) {
			c.warn(stmt)
		}
	}
}

func (c *unnecessaryBlockChecker) hasDefinitions(stmt *ast.BlockStmt) bool {
	for _, bs := range stmt.List {
		switch stmt := bs.(type) {
		case *ast.AssignStmt:
			if stmt.Tok == token.DEFINE {
				return true
			}
		case *ast.DeclStmt:
			decl := stmt.Decl.(*ast.GenDecl)
			if len(decl.Specs) != 0 {
				return true
			}
		}
	}

	return false
}

func (c *unnecessaryBlockChecker) warn(expr ast.Stmt) {
	c.ctx.Warn(expr, "block doesn't have definitions, can be simply deleted")
}
