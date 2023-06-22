package angulardetector

import (
	"fmt"
	"io"
	"regexp"

	"github.com/grafana/grafana/pkg/plugins"
)

// defaultDetectors contains all the detectors to detect Angular plugins.
// They are executed in the specified order.
var defaultDetectors = []detector{
	&containsBytesDetector{pattern: []byte("PanelCtrl")},
	&containsBytesDetector{pattern: []byte("ConfigCtrl")},
	&containsBytesDetector{pattern: []byte("app/plugins/sdk")},
	&containsBytesDetector{pattern: []byte("angular.isNumber(")},
	&containsBytesDetector{pattern: []byte("editor.html")},
	&containsBytesDetector{pattern: []byte("ctrl.annotation")},
	&containsBytesDetector{pattern: []byte("getLegacyAngularInjector")},

	&regexDetector{regex: regexp.MustCompile(`["']QueryCtrl["']`)},
}

// PatternsListInspector matches module.js against all the specified patterns, in sequence.
type PatternsListInspector struct {
	detectors []detector
}

// NewDefaultPatternsListInspector returns a new *PatternsListInspector using defaultDetectors as detectors.
func NewDefaultPatternsListInspector() *PatternsListInspector {
	return &PatternsListInspector{detectors: defaultDetectors}
}

func ProvideService() Inspector {
	return NewDefaultPatternsListInspector()
}

func (i *PatternsListInspector) Inspect(p *plugins.Plugin) (isAngular bool, err error) {
	f, err := p.FS.Open("module.js")
	if err != nil {
		return false, fmt.Errorf("open module.js: %w", err)
	}
	defer func() {
		if closeErr := f.Close(); closeErr != nil && err == nil {
			err = fmt.Errorf("close module.js: %w", closeErr)
		}
	}()
	b, err := io.ReadAll(f)
	if err != nil {
		return false, fmt.Errorf("module.js readall: %w", err)
	}
	for _, d := range i.detectors {
		if d.Detect(b) {
			isAngular = true
			break
		}
	}
	return
}
