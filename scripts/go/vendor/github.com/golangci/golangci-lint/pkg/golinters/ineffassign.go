package golinters

import (
	"fmt"
	"sync"

	"github.com/golangci/ineffassign"
	"golang.org/x/tools/go/analysis"

	"github.com/golangci/golangci-lint/pkg/golinters/goanalysis"
	"github.com/golangci/golangci-lint/pkg/lint/linter"
	"github.com/golangci/golangci-lint/pkg/result"
)

const ineffassignName = "ineffassign"

func NewIneffassign() *goanalysis.Linter {
	var mu sync.Mutex
	var resIssues []result.Issue

	analyzer := &analysis.Analyzer{
		Name: goanalysis.TheOnlyAnalyzerName,
		Doc:  goanalysis.TheOnlyanalyzerDoc,
	}
	return goanalysis.NewLinter(
		ineffassignName,
		"Detects when assignments to existing variables are not used",
		[]*analysis.Analyzer{analyzer},
		nil,
	).WithContextSetter(func(lintCtx *linter.Context) {
		analyzer.Run = func(pass *analysis.Pass) (interface{}, error) {
			var fileNames []string
			for _, f := range pass.Files {
				pos := pass.Fset.Position(f.Pos())
				fileNames = append(fileNames, pos.Filename)
			}

			issues := ineffassign.Run(fileNames)
			if len(issues) == 0 {
				return nil, nil
			}

			res := make([]result.Issue, 0, len(issues))
			for _, i := range issues {
				res = append(res, result.Issue{
					Pos:        i.Pos,
					Text:       fmt.Sprintf("ineffectual assignment to %s", formatCode(i.IdentName, lintCtx.Cfg)),
					FromLinter: ineffassignName,
				})
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
