package angulardetector

import (
	"context"
	"fmt"
	"io"

	"github.com/grafana/grafana/pkg/plugins"
)

// Inspector can inspect a module.js and determine if it's an Angular plugin or not.
type Inspector interface {
	// Inspect open module.js and checks if the plugin is using Angular by matching against its source code.
	// It returns true if module.js matches against any of the detectors in angularDetectors.
	Inspect(ctx context.Context, p *plugins.Plugin) (bool, error)
}

// PatternsListInspector matches module.js against all the patterns returned by the detectorsGetter, in sequence.
type PatternsListInspector struct {
	// detectorsGetter returns the detectors that will be used by Inspect.
	detectorsGetter detectorsGetter
}

func (i *PatternsListInspector) Inspect(ctx context.Context, p *plugins.Plugin) (isAngular bool, err error) {
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
	for _, d := range i.detectorsGetter.getDetectors(ctx) {
		if d.Detect(b) {
			isAngular = true
			break
		}
	}
	return
}
