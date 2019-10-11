package golinters

import (
	"sync"

	goimportsAPI "github.com/golangci/gofmt/goimports"
	"github.com/pkg/errors"
	"golang.org/x/tools/go/analysis"
	"golang.org/x/tools/imports"

	"github.com/golangci/golangci-lint/pkg/golinters/goanalysis"
	"github.com/golangci/golangci-lint/pkg/lint/linter"
	"github.com/golangci/golangci-lint/pkg/result"
)

const goimportsName = "goimports"

func NewGoimports() *goanalysis.Linter {
	var mu sync.Mutex
	var resIssues []result.Issue

	analyzer := &analysis.Analyzer{
		Name: goanalysis.TheOnlyAnalyzerName,
		Doc:  goanalysis.TheOnlyanalyzerDoc,
	}
	return goanalysis.NewLinter(
		goimportsName,
		"Goimports does everything that gofmt does. Additionally it checks unused imports",
		[]*analysis.Analyzer{analyzer},
		nil,
	).WithContextSetter(func(lintCtx *linter.Context) {
		imports.LocalPrefix = lintCtx.Settings().Goimports.LocalPrefixes
		analyzer.Run = func(pass *analysis.Pass) (interface{}, error) {
			var fileNames []string
			for _, f := range pass.Files {
				pos := pass.Fset.Position(f.Pos())
				fileNames = append(fileNames, pos.Filename)
			}

			var issues []result.Issue

			for _, f := range fileNames {
				diff, err := goimportsAPI.Run(f)
				if err != nil { // TODO: skip
					return nil, err
				}
				if diff == nil {
					continue
				}

				is, err := extractIssuesFromPatch(string(diff), lintCtx.Log, lintCtx, true)
				if err != nil {
					return nil, errors.Wrapf(err, "can't extract issues from gofmt diff output %q", string(diff))
				}

				issues = append(issues, is...)
			}

			if len(issues) == 0 {
				return nil, nil
			}

			mu.Lock()
			resIssues = append(resIssues, issues...)
			mu.Unlock()

			return nil, nil
		}
	}).WithIssuesReporter(func(*linter.Context) []result.Issue {
		return resIssues
	}).WithLoadMode(goanalysis.LoadModeSyntax)
}
