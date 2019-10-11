package rule

import (
	"go/ast"

	"github.com/mgechev/revive/lint"
)

// BlankImportsRule lints given else constructs.
type BlankImportsRule struct{}

// Apply applies the rule to given file.
func (r *BlankImportsRule) Apply(file *lint.File, _ lint.Arguments) []lint.Failure {
	var failures []lint.Failure

	fileAst := file.AST
	walker := lintBlankImports{
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
func (r *BlankImportsRule) Name() string {
	return "blank-imports"
}

type lintBlankImports struct {
	fileAst   *ast.File
	file      *lint.File
	onFailure func(lint.Failure)
}

func (w lintBlankImports) Visit(_ ast.Node) ast.Visitor {
	// In package main and in tests, we don't complain about blank imports.
	if w.file.Pkg.IsMain() || w.file.IsTest() {
		return nil
	}

	// The first element of each contiguous group of blank imports should have
	// an explanatory comment of some kind.
	for i, imp := range w.fileAst.Imports {
		pos := w.file.ToPosition(imp.Pos())

		if !isBlank(imp.Name) {
			continue // Ignore non-blank imports.
		}
		if i > 0 {
			prev := w.fileAst.Imports[i-1]
			prevPos := w.file.ToPosition(prev.Pos())
			if isBlank(prev.Name) && prevPos.Line+1 == pos.Line {
				continue // A subsequent blank in a group.
			}
		}

		// This is the first blank import of a group.
		if imp.Doc == nil && imp.Comment == nil {
			w.onFailure(lint.Failure{
				Node:       imp,
				Failure:    "a blank import should be only in a main or test package, or have a comment justifying it",
				Confidence: 1,
				Category:   "imports",
			})
		}
	}
	return nil
}
