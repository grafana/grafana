package angulardetector

import (
	"fmt"
	"io"
	"regexp"

	"github.com/grafana/grafana/pkg/plugins"
)

var angularDetectionRegexes = []*regexp.Regexp{
	regexp.MustCompile(`['"](app/core/utils/promiseToDigest)|(app/plugins/.*?)|(app/core/core_module)['"]`),
	regexp.MustCompile(`from\s+['"]grafana\/app\/`),
	regexp.MustCompile(`System\.register\(`),
}

// Inspect open module.js and checks if the plugin is using Angular by matching against its source code.
func Inspect(p *plugins.Plugin) (isAngular bool, err error) {
	f, err := p.FS.Open("module.js")
	if err != nil {
		return false, fmt.Errorf("module.js open: %w", err)
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
	for _, r := range angularDetectionRegexes {
		if r.Match(b) {
			isAngular = true
			break
		}
	}
	return
}
