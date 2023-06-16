package angulardetector

import (
	"context"
	"fmt"
	"io"

	"github.com/grafana/grafana/pkg/plugins"
)

// Inspector can inspect a plugin and determine if it's an Angular plugin or not.
type Inspector interface {
	// Inspect takes a plugin and checks if the plugin is using Angular.
	Inspect(ctx context.Context, p *plugins.Plugin) (bool, error)
}

// PatternsListInspector is an Inspector that matches a plugin's module.js against all the patterns returned by
// the detectorsProvider, in sequence.
type PatternsListInspector struct {
	// detectorsProvider returns the detectors that will be used by Inspect.
	detectorsProvider detectorsProvider
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
	for _, d := range i.detectorsProvider.provideDetectors(ctx) {
		if d.detect(b) {
			isAngular = true
			break
		}
	}
	return
}
