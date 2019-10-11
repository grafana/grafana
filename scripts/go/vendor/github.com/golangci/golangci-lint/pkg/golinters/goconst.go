package golinters

import (
	"fmt"
	"sync"

	goconstAPI "github.com/golangci/goconst"
	"golang.org/x/tools/go/analysis"

	"github.com/golangci/golangci-lint/pkg/golinters/goanalysis"
	"github.com/golangci/golangci-lint/pkg/lint/linter"
	"github.com/golangci/golangci-lint/pkg/result"
)

const goconstName = "goconst"

func NewGoconst() *goanalysis.Linter {
	var mu sync.Mutex
	var resIssues []result.Issue

	analyzer := &analysis.Analyzer{
		Name: goanalysis.TheOnlyAnalyzerName,
		Doc:  goanalysis.TheOnlyanalyzerDoc,
	}
	return goanalysis.NewLinter(
		goconstName,
		"Finds repeated strings that could be replaced by a constant",
		[]*analysis.Analyzer{analyzer},
		nil,
	).WithContextSetter(func(lintCtx *linter.Context) {
		analyzer.Run = func(pass *analysis.Pass) (interface{}, error) {
			issues, err := checkConstants(pass, lintCtx)
			if err != nil || len(issues) == 0 {
				return nil, err
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

func checkConstants(pass *analysis.Pass, lintCtx *linter.Context) ([]result.Issue, error) {
	cfg := goconstAPI.Config{
		MatchWithConstants: true,
		MinStringLength:    lintCtx.Settings().Goconst.MinStringLen,
		MinOccurrences:     lintCtx.Settings().Goconst.MinOccurrencesCount,
	}

	goconstIssues, err := goconstAPI.Run(pass.Files, pass.Fset, &cfg)
	if err != nil {
		return nil, err
	}

	if len(goconstIssues) == 0 {
		return nil, nil
	}

	res := make([]result.Issue, 0, len(goconstIssues))
	for _, i := range goconstIssues {
		textBegin := fmt.Sprintf("string %s has %d occurrences", formatCode(i.Str, lintCtx.Cfg), i.OccurencesCount)
		var textEnd string
		if i.MatchingConst == "" {
			textEnd = ", make it a constant"
		} else {
			textEnd = fmt.Sprintf(", but such constant %s already exists", formatCode(i.MatchingConst, lintCtx.Cfg))
		}
		res = append(res, result.Issue{
			Pos:        i.Pos,
			Text:       textBegin + textEnd,
			FromLinter: goconstName,
		})
	}

	return res, nil
}
