package rule

import (
	"fmt"
	"go/ast"

	"github.com/mgechev/revive/lint"
)

// DeepExitRule lints program exit at functions other than main or init.
type DeepExitRule struct{}

// Apply applies the rule to given file.
func (r *DeepExitRule) Apply(file *lint.File, _ lint.Arguments) []lint.Failure {
	var failures []lint.Failure
	onFailure := func(failure lint.Failure) {
		failures = append(failures, failure)
	}

	var exitFunctions = map[string]map[string]bool{
		"os":      map[string]bool{"Exit": true},
		"syscall": map[string]bool{"Exit": true},
		"log": map[string]bool{
			"Fatal":   true,
			"Fatalf":  true,
			"Fatalln": true,
			"Panic":   true,
			"Panicf":  true,
			"Panicln": true,
		},
	}

	w := lintDeepExit{onFailure, exitFunctions, false}
	ast.Walk(w, file.AST)
	return failures
}

// Name returns the rule name.
func (r *DeepExitRule) Name() string {
	return "deep-exit"
}

type lintDeepExit struct {
	onFailure     func(lint.Failure)
	exitFunctions map[string]map[string]bool
	ignore        bool
}

func (w lintDeepExit) Visit(node ast.Node) ast.Visitor {
	if stmt, ok := node.(*ast.FuncDecl); ok {
		w.updateIgnore(stmt)
		return w
	}

	if w.ignore {
		return w
	}

	se, ok := node.(*ast.ExprStmt)
	if !ok {
		return w
	}
	ce, ok := se.X.(*ast.CallExpr)
	if !ok {
		return w
	}

	fc, ok := ce.Fun.(*ast.SelectorExpr)
	if !ok {
		return w
	}
	id, ok := fc.X.(*ast.Ident)
	if !ok {
		return w
	}

	fn := fc.Sel.Name
	pkg := id.Name
	if w.exitFunctions[pkg] != nil && w.exitFunctions[pkg][fn] { // it's a call to an exit function
		w.onFailure(lint.Failure{
			Confidence: 1,
			Node:       ce,
			Category:   "bad practice",
			Failure:    fmt.Sprintf("calls to %s.%s only in main() or init() functions", pkg, fn),
		})
	}

	return w
}

func (w *lintDeepExit) updateIgnore(fd *ast.FuncDecl) {
	fn := fd.Name.Name
	w.ignore = (fn == "init" || fn == "main")
}
