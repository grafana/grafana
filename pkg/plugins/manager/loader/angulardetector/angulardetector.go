package angulardetector

import (
	"bytes"
	"fmt"
	"io"
	"regexp"

	"github.com/grafana/grafana/pkg/plugins"
)

var (
	_ detector = &containsBytesDetector{}
	_ detector = &regexDetector{}
)

// detector implements a check to see if a plugin uses Angular.
type detector interface {
	// Detect takes the content of a moduleJs file and returns true if the plugin is using Angular.
	Detect(moduleJs []byte) bool
}

// containsBytesDetector is a detector that returns true if module.js contains the "pattern" string.
type containsBytesDetector struct {
	pattern []byte
}

// Detect returns true if moduleJs contains the byte slice d.pattern.
func (d *containsBytesDetector) Detect(moduleJs []byte) bool {
	return bytes.Contains(moduleJs, d.pattern)
}

// regexDetector is a detector that returns true if the module.js content matches a regular expression.
type regexDetector struct {
	regex *regexp.Regexp
}

// Detect returns true if moduleJs matches the regular expression d.regex.
func (d *regexDetector) Detect(moduleJs []byte) bool {
	return d.regex.Match(moduleJs)
}

// angularDetectors contains all the detectors to detect Angular plugins.
// They are executed in the specified order.
var angularDetectors = []detector{
	&containsBytesDetector{pattern: []byte("PanelCtrl")},
	&containsBytesDetector{pattern: []byte("QueryCtrl")},
	&containsBytesDetector{pattern: []byte("app/plugins/sdk")},
	&containsBytesDetector{pattern: []byte("angular.isNumber(")},
	&containsBytesDetector{pattern: []byte("editor.html")},
	&containsBytesDetector{pattern: []byte("ctrl.annotation")},
	&containsBytesDetector{pattern: []byte("getLegacyAngularInjector")},

	&regexDetector{regex: regexp.MustCompile(`['"](app/core/utils/promiseToDigest)|(app/plugins/.*?)|(app/core/core_module)['"]`)},
	&regexDetector{regex: regexp.MustCompile(`from\s+['"]grafana\/app\/`)},
	&regexDetector{regex: regexp.MustCompile(`System\.register\(`)},
}

// Inspect open module.js and checks if the plugin is using Angular by matching against its source code.
// It returns true if module.js matches against any of the detectors in angularDetectors.
func Inspect(p *plugins.Plugin) (isAngular bool, err error) {
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
	for _, d := range angularDetectors {
		if d.Detect(b) {
			isAngular = true
			break
		}
	}
	return
}
