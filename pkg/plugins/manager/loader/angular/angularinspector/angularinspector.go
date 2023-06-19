package angularinspector

import (
	"context"
	"errors"
	"fmt"
	"io"
	"regexp"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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
		if d.Detect(b) {
			isAngular = true
			break
		}
	}
	return
}

// defaultDetectors contains all the detectors to Detect Angular plugins.
// They are executed in the specified order.
var defaultDetectors = []angulardetector.Detector{
	&angulardetector.ContainsBytesDetector{Pattern: []byte("PanelCtrl")},
	&angulardetector.ContainsBytesDetector{Pattern: []byte("QueryCtrl")},
	&angulardetector.ContainsBytesDetector{Pattern: []byte("app/plugins/sdk")},
	&angulardetector.ContainsBytesDetector{Pattern: []byte("angular.isNumber(")},
	&angulardetector.ContainsBytesDetector{Pattern: []byte("editor.html")},
	&angulardetector.ContainsBytesDetector{Pattern: []byte("ctrl.annotation")},
	&angulardetector.ContainsBytesDetector{Pattern: []byte("getLegacyAngularInjector")},

	&angulardetector.RegexDetector{Regex: regexp.MustCompile(`['"](app/core/utils/promiseToDigest)|(app/plugins/.*?)|(app/core/core_module)['"]`)},
	&angulardetector.RegexDetector{Regex: regexp.MustCompile(`from\s+['"]grafana\/app\/`)},
	&angulardetector.RegexDetector{Regex: regexp.MustCompile(`System\.register\(`)},
}

// newDefaultStaticDetectorsProvider returns a new StaticDetectorsProvider with the default (static, hardcoded) angular
// detection patterns (defaultDetectors)
func newDefaultStaticDetectorsProvider() angulardetector.DetectorsProvider {
	return &angulardetector.StaticDetectorsProvider{Detectors: defaultDetectors}
}

// newDynamicInspector returns the default dynamic Inspector, which is a PatternsListInspector that will:
//  1. Try to get the Angular detectors from GCOM
//  2. If it fails, it will use the static (hardcoded) detections provided by defaultDetectors.
func newDynamicInspector(cfg *config.Cfg) (Inspector, error) {
	dynamicProvider, err := angulardetector.NewGCOMDetectorsProvider(
		cfg.GrafanaComURL,
		angulardetector.DefaultGCOMDetectorsProviderTTL,
	)
	if err != nil {
		return nil, fmt.Errorf("newGCOMDetectorsProvider: %w", err)
	}
	return &PatternsListInspector{
		DetectorsProvider: angulardetector.SequenceDetectorsProvider{
			dynamicProvider,
			newDefaultStaticDetectorsProvider(),
		},
	}, nil
}

// newStaticInspector returns the default Inspector, which is a PatternsListInspector that only uses the
// static (hardcoded) angular detection patterns.
func newStaticInspector() (Inspector, error) {
	return &PatternsListInspector{DetectorsProvider: newDefaultStaticDetectorsProvider()}, nil
}

func ProvideService(cfg *config.Cfg) (Inspector, error) {
	if cfg.Features != nil && cfg.Features.IsEnabled(featuremgmt.FlagPluginsDynamicAngularDetectionPatterns) {
		return newDynamicInspector(cfg)
	}
	return newStaticInspector()
}
