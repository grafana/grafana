// nolint:dupl
package golinters

import (
	"fmt"
	"sort"
	"sync"

	gocycloAPI "github.com/golangci/gocyclo/pkg/gocyclo"
	"golang.org/x/tools/go/analysis"

	"github.com/golangci/golangci-lint/pkg/golinters/goanalysis"
	"github.com/golangci/golangci-lint/pkg/lint/linter"
	"github.com/golangci/golangci-lint/pkg/result"
)

const gocycloName = "gocyclo"

func NewGocyclo() *goanalysis.Linter {
	var mu sync.Mutex
	var resIssues []result.Issue

	analyzer := &analysis.Analyzer{
		Name: goanalysis.TheOnlyAnalyzerName,
		Doc:  goanalysis.TheOnlyanalyzerDoc,
	}
	return goanalysis.NewLinter(
		gocycloName,
		"Computes and checks the cyclomatic complexity of functions",
		[]*analysis.Analyzer{analyzer},
		nil,
	).WithContextSetter(func(lintCtx *linter.Context) {
		analyzer.Run = func(pass *analysis.Pass) (interface{}, error) {
			var stats []gocycloAPI.Stat
			for _, f := range pass.Files {
				stats = gocycloAPI.BuildStats(f, pass.Fset, stats)
			}
			if len(stats) == 0 {
				return nil, nil
			}

			sort.Slice(stats, func(i, j int) bool {
				return stats[i].Complexity > stats[j].Complexity
			})

			res := make([]result.Issue, 0, len(stats))
			for _, s := range stats {
				if s.Complexity <= lintCtx.Settings().Gocyclo.MinComplexity {
					break // Break as the stats is already sorted from greatest to least
				}

				res = append(res, result.Issue{
					Pos: s.Pos,
					Text: fmt.Sprintf("cyclomatic complexity %d of func %s is high (> %d)",
						s.Complexity, formatCode(s.FuncName, lintCtx.Cfg), lintCtx.Settings().Gocyclo.MinComplexity),
					FromLinter: gocycloName,
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
