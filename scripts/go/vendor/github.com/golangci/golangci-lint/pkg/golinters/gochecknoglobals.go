package golinters

import (
	"fmt"
	"go/ast"
	"go/token"
	"strings"
	"sync"

	"golang.org/x/tools/go/analysis"

	"github.com/golangci/golangci-lint/pkg/golinters/goanalysis"
	"github.com/golangci/golangci-lint/pkg/lint/linter"
	"github.com/golangci/golangci-lint/pkg/result"
)

const gochecknoglobalsName = "gochecknoglobals"

//nolint:dupl
func NewGochecknoglobals() *goanalysis.Linter {
	var mu sync.Mutex
	var resIssues []result.Issue

	analyzer := &analysis.Analyzer{
		Name: goanalysis.TheOnlyAnalyzerName,
		Doc:  goanalysis.TheOnlyanalyzerDoc,
		Run: func(pass *analysis.Pass) (interface{}, error) {
			var res []result.Issue
			for _, file := range pass.Files {
				res = append(res, checkFileForGlobals(file, pass.Fset)...)
			}
			if len(res) == 0 {
				return nil, nil
			}

			mu.Lock()
			resIssues = append(resIssues, res...)
			mu.Unlock()

			return nil, nil
		},
	}
	return goanalysis.NewLinter(
		gochecknoglobalsName,
		"Checks that no globals are present in Go code",
		[]*analysis.Analyzer{analyzer},
		nil,
	).WithIssuesReporter(func(*linter.Context) []result.Issue {
		return resIssues
	}).WithLoadMode(goanalysis.LoadModeSyntax)
}

func checkFileForGlobals(f *ast.File, fset *token.FileSet) []result.Issue {
	var res []result.Issue
	for _, decl := range f.Decls {
		genDecl, ok := decl.(*ast.GenDecl)
		if !ok {
			continue
		}
		if genDecl.Tok != token.VAR {
			continue
		}

		for _, spec := range genDecl.Specs {
			valueSpec := spec.(*ast.ValueSpec)
			for _, vn := range valueSpec.Names {
				if isWhitelisted(vn) {
					continue
				}

				res = append(res, result.Issue{
					Pos:        fset.Position(vn.Pos()),
					Text:       fmt.Sprintf("%s is a global variable", formatCode(vn.Name, nil)),
					FromLinter: gochecknoglobalsName,
				})
			}
		}
	}

	return res
}

func isWhitelisted(i *ast.Ident) bool {
	return i.Name == "_" || i.Name == "version" || looksLikeError(i)
}

// looksLikeError returns true if the AST identifier starts
// with 'err' or 'Err', or false otherwise.
//
// TODO: https://github.com/leighmcculloch/gochecknoglobals/issues/5
func looksLikeError(i *ast.Ident) bool {
	prefix := "err"
	if i.IsExported() {
		prefix = "Err"
	}
	return strings.HasPrefix(i.Name, prefix)
}
