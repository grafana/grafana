package golinters

import (
	"fmt"
	"go/token"
	"io/ioutil"
	"log"
	"strconv"
	"sync"

	"github.com/securego/gosec"
	"github.com/securego/gosec/rules"
	"golang.org/x/tools/go/analysis"
	"golang.org/x/tools/go/packages"

	"github.com/golangci/golangci-lint/pkg/golinters/goanalysis"
	"github.com/golangci/golangci-lint/pkg/lint/linter"
	"github.com/golangci/golangci-lint/pkg/result"
)

const gosecName = "gosec"

func NewGosec() *goanalysis.Linter {
	var mu sync.Mutex
	var resIssues []result.Issue

	gasConfig := gosec.NewConfig()
	enabledRules := rules.Generate()
	logger := log.New(ioutil.Discard, "", 0)

	analyzer := &analysis.Analyzer{
		Name: goanalysis.TheOnlyAnalyzerName,
		Doc:  goanalysis.TheOnlyanalyzerDoc,
	}
	return goanalysis.NewLinter(
		gosecName,
		"Inspects source code for security problems",
		[]*analysis.Analyzer{analyzer},
		nil,
	).WithContextSetter(func(lintCtx *linter.Context) {
		analyzer.Run = func(pass *analysis.Pass) (interface{}, error) {
			gosecAnalyzer := gosec.NewAnalyzer(gasConfig, true, logger)
			gosecAnalyzer.LoadRules(enabledRules.Builders())
			pkg := &packages.Package{
				Fset:      pass.Fset,
				Syntax:    pass.Files,
				Types:     pass.Pkg,
				TypesInfo: pass.TypesInfo,
			}
			gosecAnalyzer.Check(pkg)
			issues, _, _ := gosecAnalyzer.Report()
			if len(issues) == 0 {
				return nil, nil
			}

			res := make([]result.Issue, 0, len(issues))
			for _, i := range issues {
				text := fmt.Sprintf("%s: %s", i.RuleID, i.What) // TODO: use severity and confidence
				var r *result.Range
				line, err := strconv.Atoi(i.Line)
				if err != nil {
					r = &result.Range{}
					if n, rerr := fmt.Sscanf(i.Line, "%d-%d", &r.From, &r.To); rerr != nil || n != 2 {
						lintCtx.Log.Warnf("Can't convert gosec line number %q of %v to int: %s", i.Line, i, err)
						continue
					}
					line = r.From
				}

				res = append(res, result.Issue{
					Pos: token.Position{
						Filename: i.File,
						Line:     line,
					},
					Text:       text,
					LineRange:  r,
					FromLinter: gosecName,
				})
			}

			mu.Lock()
			resIssues = append(resIssues, res...)
			mu.Unlock()

			return nil, nil
		}
	}).WithIssuesReporter(func(*linter.Context) []result.Issue {
		return resIssues
	}).WithLoadMode(goanalysis.LoadModeTypesInfo)
}
