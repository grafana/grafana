package rule

import (
	"go/ast"

	"github.com/mgechev/revive/lint"
)

// ContextAsArgumentRule lints given else constructs.
type ContextAsArgumentRule struct{}

// Apply applies the rule to given file.
func (r *ContextAsArgumentRule) Apply(file *lint.File, _ lint.Arguments) []lint.Failure {
	var failures []lint.Failure

	fileAst := file.AST
	walker := lintContextArguments{
		file:    file,
		fileAst: fileAst,
		onFailure: func(failure lint.Failure) {
			failures = append(failures, failure)
		},
	}

	ast.Walk(walker, fileAst)

	return failures
}

// Name returns the rule name.
func (r *ContextAsArgumentRule) Name() string {
	return "context-as-argument"
}

type lintContextArguments struct {
	file      *lint.File
	fileAst   *ast.File
	onFailure func(lint.Failure)
}

func (w lintContextArguments) Visit(n ast.Node) ast.Visitor {
	fn, ok := n.(*ast.FuncDecl)
	if !ok || len(fn.Type.Params.List) <= 1 {
		return w
	}
	// A context.Context should be the first parameter of a function.
	// Flag any that show up after the first.
	for _, arg := range fn.Type.Params.List[1:] {
		if isPkgDot(arg.Type, "context", "Context") {
			w.onFailure(lint.Failure{
				Node:       fn,
				Category:   "arg-order",
				Failure:    "context.Context should be the first parameter of a function",
				Confidence: 0.9,
			})
			break // only flag one
		}
	}
	return w
}
