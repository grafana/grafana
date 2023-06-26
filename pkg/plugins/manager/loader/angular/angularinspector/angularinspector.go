package angularinspector

import (
	"context"
	"errors"
	"fmt"
	"io"
	"regexp"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
)

// Inspector can inspect a plugin and determine if it's an Angular plugin or not.
type Inspector interface {
	// Inspect takes a plugin and checks if the plugin is using Angular.
	Inspect(ctx context.Context, p *plugins.Plugin) (bool, error)
}

// PatternsListInspector is an Inspector that matches a plugin's module.js against all the patterns returned by
// the detectorsProvider, in sequence.
type PatternsListInspector struct {
	// DetectorsProvider returns the detectors that will be used by Inspect.
	DetectorsProvider angulardetector.DetectorsProvider
}

func (i *PatternsListInspector) Inspect(ctx context.Context, p *plugins.Plugin) (isAngular bool, err error) {
	f, err := p.FS.Open("module.js")
	if err != nil {
		if errors.Is(err, plugins.ErrFileNotExist) {
			// We may not have a module.js for some backend plugins, so ignore the error if module.js does not exist
			return false, nil
		}
		return false, err
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
	for _, d := range i.DetectorsProvider.ProvideDetectors(ctx) {
		if d.DetectAngular(b) {
			isAngular = true
			break
		}
	}
	return
}

// defaultDetectors contains all the detectors to DetectAngular Angular plugins.
// They are executed in the specified order.
var defaultDetectors = []angulardetector.AngularDetector{
	&angulardetector.ContainsBytesDetector{Pattern: []byte("PanelCtrl")},
	&angulardetector.ContainsBytesDetector{Pattern: []byte("ConfigCtrl")},
	&angulardetector.ContainsBytesDetector{Pattern: []byte("app/plugins/sdk")},
	&angulardetector.ContainsBytesDetector{Pattern: []byte("angular.isNumber(")},
	&angulardetector.ContainsBytesDetector{Pattern: []byte("editor.html")},
	&angulardetector.ContainsBytesDetector{Pattern: []byte("ctrl.annotation")},
	&angulardetector.ContainsBytesDetector{Pattern: []byte("getLegacyAngularInjector")},

	&angulardetector.RegexDetector{Regex: regexp.MustCompile(`["']QueryCtrl["']`)},
}

// NewDefaultStaticDetectorsProvider returns a new StaticDetectorsProvider with the default (static, hardcoded) angular
// detection patterns (defaultDetectors)
func NewDefaultStaticDetectorsProvider() angulardetector.DetectorsProvider {
	return &angulardetector.StaticDetectorsProvider{Detectors: defaultDetectors}
}

// NewStaticInspector returns the default Inspector, which is a PatternsListInspector that only uses the
// static (hardcoded) angular detection patterns.
func NewStaticInspector() (Inspector, error) {
	return &PatternsListInspector{DetectorsProvider: NewDefaultStaticDetectorsProvider()}, nil
}
