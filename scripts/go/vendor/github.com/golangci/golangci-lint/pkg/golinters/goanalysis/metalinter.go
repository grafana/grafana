package goanalysis

import (
	"context"

	"github.com/pkg/errors"
	"golang.org/x/tools/go/analysis"

	"github.com/golangci/golangci-lint/pkg/lint/linter"
	"github.com/golangci/golangci-lint/pkg/result"
)

type MetaLinter struct {
	linters []*Linter
}

func NewMetaLinter(linters []*Linter) *MetaLinter {
	return &MetaLinter{linters: linters}
}

func (ml MetaLinter) Name() string {
	return "goanalysis_metalinter"
}

func (ml MetaLinter) Desc() string {
	return ""
}

func (ml MetaLinter) isTypecheckMode() bool {
	for _, linter := range ml.linters {
		if linter.isTypecheckMode {
			return true
		}
	}
	return false
}

func (ml MetaLinter) getLoadMode() LoadMode {
	loadMode := LoadModeNone
	for _, linter := range ml.linters {
		if linter.loadMode > loadMode {
			loadMode = linter.loadMode
		}
	}
	return loadMode
}

func (ml MetaLinter) runContextSetters(lintCtx *linter.Context) {
	for _, linter := range ml.linters {
		if linter.contextSetter != nil {
			linter.contextSetter(lintCtx)
		}
	}
}

func (ml MetaLinter) getAllAnalyzers() []*analysis.Analyzer {
	var allAnalyzers []*analysis.Analyzer
	for _, linter := range ml.linters {
		allAnalyzers = append(allAnalyzers, linter.analyzers...)
	}
	return allAnalyzers
}

func (ml MetaLinter) getAnalyzerToLinterNameMapping() map[*analysis.Analyzer]string {
	analyzerToLinterName := map[*analysis.Analyzer]string{}
	for _, linter := range ml.linters {
		for _, a := range linter.analyzers {
			analyzerToLinterName[a] = linter.Name()
		}
	}
	return analyzerToLinterName
}

func (ml MetaLinter) configure() error {
	for _, linter := range ml.linters {
		if err := linter.configure(); err != nil {
			return errors.Wrapf(err, "failed to configure analyzers of %s", linter.Name())
		}
	}
	return nil
}

func (ml MetaLinter) validate() error {
	for _, linter := range ml.linters {
		if err := analysis.Validate(linter.analyzers); err != nil {
			return errors.Wrapf(err, "failed to validate analyzers of %s", linter.Name())
		}
	}
	return nil
}

func (ml MetaLinter) Run(ctx context.Context, lintCtx *linter.Context) ([]result.Issue, error) {
	if err := ml.validate(); err != nil {
		return nil, err
	}

	if err := ml.configure(); err != nil {
		return nil, err
	}
	ml.runContextSetters(lintCtx)

	analyzerToLinterName := ml.getAnalyzerToLinterNameMapping()

	runner := newRunner("metalinter", lintCtx.Log.Child("goanalysis"),
		lintCtx.PkgCache, lintCtx.LoadGuard, ml.getLoadMode())

	diags, errs := runner.run(ml.getAllAnalyzers(), lintCtx.Packages)

	buildAllIssues := func() []result.Issue {
		linterNameBuilder := func(diag *Diagnostic) string { return analyzerToLinterName[diag.Analyzer] }
		issues := buildIssues(diags, linterNameBuilder)

		for _, linter := range ml.linters {
			if linter.issuesReporter != nil {
				issues = append(issues, linter.issuesReporter(lintCtx)...)
			}
		}
		return issues
	}

	if ml.isTypecheckMode() {
		issues, err := buildIssuesFromErrorsForTypecheckMode(errs, lintCtx)
		if err != nil {
			return nil, err
		}
		return append(issues, buildAllIssues()...), nil
	}

	// Don't print all errs: they can duplicate.
	if len(errs) != 0 {
		return nil, errs[0]
	}

	return buildAllIssues(), nil
}
