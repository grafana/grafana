package rule

import (
	"go/ast"

	"github.com/mgechev/revive/lint"
)

// EmptyBlockRule lints given else constructs.
type EmptyBlockRule struct{}

// Apply applies the rule to given file.
func (r *EmptyBlockRule) Apply(file *lint.File, _ lint.Arguments) []lint.Failure {
	var failures []lint.Failure

	onFailure := func(failure lint.Failure) {
		failures = append(failures, failure)
	}

	w := lintEmptyBlock{make([]*ast.BlockStmt, 0), onFailure}
	ast.Walk(w, file.AST)
	return failures
}

// Name returns the rule name.
func (r *EmptyBlockRule) Name() string {
	return "empty-block"
}

type lintEmptyBlock struct {
	ignore    []*ast.BlockStmt
	onFailure func(lint.Failure)
}

func (w lintEmptyBlock) Visit(node ast.Node) ast.Visitor {
	fd, ok := node.(*ast.FuncDecl)
	if ok {
		w.ignore = append(w.ignore, fd.Body)
		return w
	}

	fl, ok := node.(*ast.FuncLit)
	if ok {
		w.ignore = append(w.ignore, fl.Body)
		return w
	}

	block, ok := node.(*ast.BlockStmt)
	if !ok {
		return w
	}

	if mustIgnore(block, w.ignore) {
		return w
	}

	if len(block.List) == 0 {
		w.onFailure(lint.Failure{
			Confidence: 1,
			Node:       block,
			Category:   "logic",
			Failure:    "this block is empty, you can remove it",
		})
	}

	return w
}

func mustIgnore(block *ast.BlockStmt, blackList []*ast.BlockStmt) bool {
	for _, b := range blackList {
		if b == block {
			return true
		}
	}
	return false
}
