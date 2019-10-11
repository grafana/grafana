package golinters

import (
	"fmt"
	"strings"
	"sync"

	"github.com/OpenPeeDeeP/depguard"
	"golang.org/x/tools/go/analysis"
	"golang.org/x/tools/go/loader"

	"github.com/golangci/golangci-lint/pkg/golinters/goanalysis"
	"github.com/golangci/golangci-lint/pkg/lint/linter"
	"github.com/golangci/golangci-lint/pkg/result"
)

func setDepguardListType(dg *depguard.Depguard, lintCtx *linter.Context) error {
	listType := lintCtx.Settings().Depguard.ListType
	var found bool
	dg.ListType, found = depguard.StringToListType[strings.ToLower(listType)]
	if !found {
		if listType != "" {
			return fmt.Errorf("unsure what list type %s is", listType)
		}
		dg.ListType = depguard.LTBlacklist
	}

	return nil
}

func setupDepguardPackages(dg *depguard.Depguard, lintCtx *linter.Context) {
	if dg.ListType == depguard.LTBlacklist {
		// if the list type was a blacklist the packages with error messages should
		// be included in the blacklist package list

		noMessagePackages := make(map[string]bool)
		for _, pkg := range dg.Packages {
			noMessagePackages[pkg] = true
		}

		for pkg := range lintCtx.Settings().Depguard.PackagesWithErrorMessage {
			if _, ok := noMessagePackages[pkg]; !ok {
				dg.Packages = append(dg.Packages, pkg)
			}
		}
	}
}

func NewDepguard() *goanalysis.Linter {
	const linterName = "depguard"
	var mu sync.Mutex
	var resIssues []result.Issue

	analyzer := &analysis.Analyzer{
		Name: goanalysis.TheOnlyAnalyzerName,
		Doc:  goanalysis.TheOnlyanalyzerDoc,
	}
	return goanalysis.NewLinter(
		linterName,
		"Go linter that checks if package imports are in a list of acceptable packages",
		[]*analysis.Analyzer{analyzer},
		nil,
	).WithContextSetter(func(lintCtx *linter.Context) {
		dgSettings := &lintCtx.Settings().Depguard
		analyzer.Run = func(pass *analysis.Pass) (interface{}, error) {
			prog := goanalysis.MakeFakeLoaderProgram(pass)
			dg := &depguard.Depguard{
				Packages:      dgSettings.Packages,
				IncludeGoRoot: dgSettings.IncludeGoRoot,
			}
			if err := setDepguardListType(dg, lintCtx); err != nil {
				return nil, err
			}
			setupDepguardPackages(dg, lintCtx)

			loadConfig := &loader.Config{
				Cwd:   "",  // fallbacked to os.Getcwd
				Build: nil, // fallbacked to build.Default
			}
			issues, err := dg.Run(loadConfig, prog)
			if err != nil {
				return nil, err
			}
			if len(issues) == 0 {
				return nil, nil
			}
			msgSuffix := "is in the blacklist"
			if dg.ListType == depguard.LTWhitelist {
				msgSuffix = "is not in the whitelist"
			}
			res := make([]result.Issue, 0, len(issues))
			for _, i := range issues {
				userSuppliedMsgSuffix := dgSettings.PackagesWithErrorMessage[i.PackageName]
				if userSuppliedMsgSuffix != "" {
					userSuppliedMsgSuffix = ": " + userSuppliedMsgSuffix
				}
				res = append(res, result.Issue{
					Pos:        i.Position,
					Text:       fmt.Sprintf("%s %s%s", formatCode(i.PackageName, lintCtx.Cfg), msgSuffix, userSuppliedMsgSuffix),
					FromLinter: linterName,
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
