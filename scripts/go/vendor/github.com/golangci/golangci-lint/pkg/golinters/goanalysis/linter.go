package goanalysis

import (
	"context"
	"flag"
	"fmt"
	"strings"

	"golang.org/x/tools/go/packages"

	"github.com/pkg/errors"
	"golang.org/x/tools/go/analysis"

	"github.com/golangci/golangci-lint/pkg/lint/linter"
	libpackages "github.com/golangci/golangci-lint/pkg/packages"
	"github.com/golangci/golangci-lint/pkg/result"
)

const (
	TheOnlyAnalyzerName = "the_only_name"
	TheOnlyanalyzerDoc  = "the_only_doc"
)

type LoadMode int

const (
	LoadModeNone LoadMode = iota
	LoadModeSyntax
	LoadModeTypesInfo
	LoadModeWholeProgram
)

func (loadMode LoadMode) String() string {
	switch loadMode {
	case LoadModeNone:
		return "none"
	case LoadModeSyntax:
		return "syntax"
	case LoadModeTypesInfo:
		return "types info"
	case LoadModeWholeProgram:
		return "whole program"
	}
	panic(fmt.Sprintf("unknown load mode %d", loadMode))
}

type Linter struct {
	name, desc          string
	analyzers           []*analysis.Analyzer
	cfg                 map[string]map[string]interface{}
	issuesReporter      func(*linter.Context) []result.Issue
	contextSetter       func(*linter.Context)
	loadMode            LoadMode
	useOriginalPackages bool
	isTypecheckMode     bool
}

func NewLinter(name, desc string, analyzers []*analysis.Analyzer, cfg map[string]map[string]interface{}) *Linter {
	return &Linter{name: name, desc: desc, analyzers: analyzers, cfg: cfg}
}

func (lnt *Linter) UseOriginalPackages() {
	lnt.useOriginalPackages = true
}

func (lnt *Linter) SetTypecheckMode() {
	lnt.isTypecheckMode = true
}

func (lnt *Linter) LoadMode() LoadMode {
	return lnt.loadMode
}

func (lnt *Linter) WithLoadMode(loadMode LoadMode) *Linter {
	lnt.loadMode = loadMode
	return lnt
}

func (lnt *Linter) WithIssuesReporter(r func(*linter.Context) []result.Issue) *Linter {
	lnt.issuesReporter = r
	return lnt
}

func (lnt *Linter) WithContextSetter(cs func(*linter.Context)) *Linter {
	lnt.contextSetter = cs
	return lnt
}

func (lnt *Linter) Name() string {
	return lnt.name
}

func (lnt *Linter) Desc() string {
	return lnt.desc
}

func (lnt *Linter) allAnalyzerNames() []string {
	var ret []string
	for _, a := range lnt.analyzers {
		ret = append(ret, a.Name)
	}
	return ret
}

func allFlagNames(fs *flag.FlagSet) []string {
	var ret []string
	fs.VisitAll(func(f *flag.Flag) {
		ret = append(ret, f.Name)
	})
	return ret
}

func valueToString(v interface{}) string {
	if ss, ok := v.([]string); ok {
		return strings.Join(ss, ",")
	}

	if is, ok := v.([]interface{}); ok {
		var ss []string
		for _, i := range is {
			ss = append(ss, fmt.Sprint(i))
		}
		return valueToString(ss)
	}

	return fmt.Sprint(v)
}

func (lnt *Linter) configureAnalyzer(a *analysis.Analyzer, cfg map[string]interface{}) error {
	for k, v := range cfg {
		f := a.Flags.Lookup(k)
		if f == nil {
			validFlagNames := allFlagNames(&a.Flags)
			if len(validFlagNames) == 0 {
				return fmt.Errorf("analyzer doesn't have settings")
			}

			return fmt.Errorf("analyzer doesn't have setting %q, valid settings: %v",
				k, validFlagNames)
		}

		if err := f.Value.Set(valueToString(v)); err != nil {
			return errors.Wrapf(err, "failed to set analyzer setting %q with value %v", k, v)
		}
	}

	return nil
}

func (lnt *Linter) configure() error {
	analyzersMap := map[string]*analysis.Analyzer{}
	for _, a := range lnt.analyzers {
		analyzersMap[a.Name] = a
	}

	for analyzerName, analyzerSettings := range lnt.cfg {
		a := analyzersMap[analyzerName]
		if a == nil {
			return fmt.Errorf("settings key %q must be valid analyzer name, valid analyzers: %v",
				analyzerName, lnt.allAnalyzerNames())
		}

		if err := lnt.configureAnalyzer(a, analyzerSettings); err != nil {
			return errors.Wrapf(err, "failed to configure analyzer %s", analyzerName)
		}
	}

	return nil
}

func parseError(srcErr packages.Error) (*result.Issue, error) {
	pos, err := libpackages.ParseErrorPosition(srcErr.Pos)
	if err != nil {
		return nil, err
	}

	return &result.Issue{
		Pos:        *pos,
		Text:       srcErr.Msg,
		FromLinter: "typecheck",
	}, nil
}

func buildIssuesFromErrorsForTypecheckMode(errs []error, lintCtx *linter.Context) ([]result.Issue, error) {
	var issues []result.Issue
	uniqReportedIssues := map[string]bool{}
	for _, err := range errs {
		itErr, ok := errors.Cause(err).(*IllTypedError)
		if !ok {
			return nil, err
		}
		for _, err := range libpackages.ExtractErrors(itErr.Pkg) {
			i, perr := parseError(err)
			if perr != nil { // failed to parse
				if uniqReportedIssues[err.Msg] {
					continue
				}
				uniqReportedIssues[err.Msg] = true
				lintCtx.Log.Errorf("typechecking error: %s", err.Msg)
			} else {
				issues = append(issues, *i)
			}
		}
	}
	return issues, nil
}

func buildIssues(diags []Diagnostic, linterNameBuilder func(diag *Diagnostic) string) []result.Issue {
	var issues []result.Issue
	for i := range diags {
		diag := &diags[i]
		var text string
		if diag.Analyzer.Name == TheOnlyAnalyzerName {
			text = diag.Message
		} else {
			text = fmt.Sprintf("%s: %s", diag.Analyzer.Name, diag.Message)
		}
		issues = append(issues, result.Issue{
			FromLinter: linterNameBuilder(diag),
			Text:       text,
			Pos:        diag.Position,
		})
	}
	return issues
}

func (lnt *Linter) Run(ctx context.Context, lintCtx *linter.Context) ([]result.Issue, error) {
	if err := analysis.Validate(lnt.analyzers); err != nil {
		return nil, errors.Wrap(err, "failed to validate analyzers")
	}

	if err := lnt.configure(); err != nil {
		return nil, errors.Wrap(err, "failed to configure analyzers")
	}

	if lnt.contextSetter != nil {
		lnt.contextSetter(lintCtx)
	}

	loadMode := lnt.loadMode
	runner := newRunner(lnt.name, lintCtx.Log.Child("goanalysis"),
		lintCtx.PkgCache, lintCtx.LoadGuard, loadMode)

	pkgs := lintCtx.Packages
	if lnt.useOriginalPackages {
		pkgs = lintCtx.OriginalPackages
	}

	diags, errs := runner.run(lnt.analyzers, pkgs)

	linterNameBuilder := func(*Diagnostic) string { return lnt.Name() }
	if lnt.isTypecheckMode {
		return buildIssuesFromErrorsForTypecheckMode(errs, lintCtx)
	}

	// Don't print all errs: they can duplicate.
	if len(errs) != 0 {
		return nil, errs[0]
	}

	var issues []result.Issue
	if lnt.issuesReporter != nil {
		issues = append(issues, lnt.issuesReporter(lintCtx)...)
	} else {
		issues = buildIssues(diags, linterNameBuilder)
	}

	return issues, nil
}
