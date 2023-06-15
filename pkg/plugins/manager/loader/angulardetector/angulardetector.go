package angulardetector

import (
	"fmt"
	"regexp"

	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// defaultDetectors contains all the detectors to detect Angular plugins.
// They are executed in the specified order.
var defaultDetectors = []detector{
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

// newDefaultStaticDetectorsProvider returns a new staticDetectorsProvider with the default (hardcoded) angular
// detection patterns (defaultDetectors)
func newDefaultStaticDetectorsProvider() detectorsProvider {
	return &staticDetectorsProvider{detectors: defaultDetectors}
}

// newRemoteInspector returns the default remote Inspector, which is a PatternsListInspector that will:
//  1. Try to get the Angular detectors from GCOM
//  2. If it fails, it will use the hardcoded detections provided by defaultDetectors.
func newRemoteInspector(cfg *config.Cfg) (Inspector, error) {
	remoteProvider, err := newGCOMDetectorsProvider(cfg.GrafanaComURL, defaultGCOMDetectorsProviderTTL)
	if err != nil {
		return nil, fmt.Errorf("newGCOMDetectorsProvider: %w", err)
	}
	return &PatternsListInspector{
		detectorsProvider: sequenceDetectorsProvider{
			remoteProvider,
			newDefaultStaticDetectorsProvider(),
		},
	}, nil
}

// newHardcodedInspector returns the default Inspector, which is a PatternsListInspector that only uses the
// hardcoded (static) angular detection patterns.
func newHardcodedInspector() (Inspector, error) {
	return &PatternsListInspector{detectorsProvider: newDefaultStaticDetectorsProvider()}, nil
}

func ProvideInspector(cfg *config.Cfg) (Inspector, error) {
	if cfg.Features != nil && cfg.Features.IsEnabled(featuremgmt.FlagPluginsRemoteAngularDetectionPatterns) {
		return newRemoteInspector(cfg)
	}
	return newHardcodedInspector()
}
