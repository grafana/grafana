package golinters

import (
	"fmt"

	"golang.org/x/tools/go/analysis"

	"github.com/golangci/golangci-lint/pkg/logutils"
)

var debugf = logutils.Debug("megacheck")

func analyzersMapToSlice(m map[string]*analysis.Analyzer) []*analysis.Analyzer {
	var ret []*analysis.Analyzer
	for _, v := range m {
		ret = append(ret, v)
	}
	return ret
}

func setAnalyzersGoVersion(analyzers []*analysis.Analyzer) {
	const goVersion = 13 // TODO
	for _, a := range analyzers {
		if v := a.Flags.Lookup("go"); v != nil {
			if err := v.Value.Set(fmt.Sprintf("1.%d", goVersion)); err != nil {
				debugf("Failed to set go version: %s", err)
			}
		}
	}
}
