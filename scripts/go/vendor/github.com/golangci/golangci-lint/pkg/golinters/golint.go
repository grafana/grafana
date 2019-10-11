package golinters

import (
	"fmt"
	"go/ast"
	"go/token"
	"sync"

	lintAPI "github.com/golangci/lint-1"
	"golang.org/x/tools/go/analysis"

	"github.com/golangci/golangci-lint/pkg/golinters/goanalysis"
	"github.com/golangci/golangci-lint/pkg/lint/linter"
	"github.com/golangci/golangci-lint/pkg/result"
)

func golintProcessPkg(minConfidence float64, files []*ast.File, fset *token.FileSet) ([]result.Issue, error) {
	l := new(lintAPI.Linter)
	ps, err := l.LintASTFiles(files, fset)
	if err != nil {
		return nil, fmt.Errorf("can't lint %d files: %s", len(files), err)
	}

	if len(ps) == 0 {
		return nil, nil
	}

	issues := make([]result.Issue, 0, len(ps)) // This is worst case
	for idx := range ps {
		if ps[idx].Confidence >= minConfidence {
			issues = append(issues, result.Issue{
				Pos:        ps[idx].Position,
				Text:       ps[idx].Text,
				FromLinter: golintName,
			})
			// TODO: use p.Link and p.Category
		}
	}

	return issues, nil
}

const golintName = "golint"

func NewGolint() *goanalysis.Linter {
	var mu sync.Mutex
	var resIssues []result.Issue

	analyzer := &analysis.Analyzer{
		Name: goanalysis.TheOnlyAnalyzerName,
		Doc:  goanalysis.TheOnlyanalyzerDoc,
	}
	return goanalysis.NewLinter(
		golintName,
		"Golint differs from gofmt. Gofmt reformats Go source code, whereas golint prints out style mistakes",
		[]*analysis.Analyzer{analyzer},
		nil,
	).WithContextSetter(func(lintCtx *linter.Context) {
		analyzer.Run = func(pass *analysis.Pass) (interface{}, error) {
			res, err := golintProcessPkg(lintCtx.Settings().Golint.MinConfidence, pass.Files, pass.Fset)
			if err != nil || len(res) == 0 {
				return nil, err
			}

			mu.Lock()
			resIssues = append(resIssues, res...)
			mu.Unlock()

			return nil, nil
		}
	}).WithIssuesReporter(func(*linter.Context) []result.Issue {
		return resIssues
	}).WithLoadMode(goanalysis.LoadModeSyntax)
}
