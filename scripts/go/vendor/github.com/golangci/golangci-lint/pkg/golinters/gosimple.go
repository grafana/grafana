package golinters

import (
	"honnef.co/go/tools/simple"

	"github.com/golangci/golangci-lint/pkg/golinters/goanalysis"
)

func NewGosimple() *goanalysis.Linter {
	analyzers := analyzersMapToSlice(simple.Analyzers)
	setAnalyzersGoVersion(analyzers)

	return goanalysis.NewLinter(
		"gosimple",
		"Linter for Go source code that specializes in simplifying a code",
		analyzers,
		nil,
	).WithLoadMode(goanalysis.LoadModeTypesInfo)
}
