package angulardetectorsprovider

import (
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
)

// Static is an angulardetector.DetectorsProvider that always calls the underlying angulardetector.DetectorsProvider.
type Static struct {
	angulardetector.DetectorsProvider
}

// ProvideStatic provides the *Static wire service, which is an angulardetector.DetectorsProvider that returns the
// default (static, hardcoded) angular detection patterns.
func ProvideStatic() *Static {
	return &Static{angulardetector.NewDefaultStaticDetectorsProvider()}
}
