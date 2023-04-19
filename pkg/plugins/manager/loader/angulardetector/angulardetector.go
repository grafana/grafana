package angulardetector

import (
	"bytes"
	"fmt"
	"io"

	"github.com/grafana/grafana/pkg/plugins"
)

var angularDetectionPatterns = [][]byte{
	[]byte("PanelCtrl"),
	[]byte("QueryCtrl"),
	[]byte("app/plugins/sdk"),
	[]byte("angular.isNumber("),
	[]byte("editor.html"),
	[]byte("ctrl.annotation"),
	[]byte("getLegacyAngularInjector"),
}

// Inspect open module.js and checks if the plugin is using Angular by matching against its source code.
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
	for _, pattern := range angularDetectionPatterns {
		if bytes.Contains(b, pattern) {
			isAngular = true
			break
		}
	}
	return
}
