package angulardetector

import (
	"fmt"
	"regexp"

	"github.com/grafana/grafana/pkg/plugins/config"
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

// newDefaultStaticDetectorsGetter returns a new staticDetectorsGetter with the default (hardcoded) angular
// detection patterns (defaultDetectors)
func newDefaultStaticDetectorsGetter() detectorsGetter {
	return &staticDetectorsGetter{detectors: defaultDetectors}
}

// newDefaultInspector returns the default Inspector, which is a PatternsListInspector that will:
//  1. Try to get the Angular detectors from GCOM
//  2. If it fails, it will use the hardcoded detections provided by defaultDetectors.
func newDefaultInspector(cfg *config.Cfg) (Inspector, error) {
	remoteGetter, err := newGCOMDetectorsGetter(cfg.GrafanaComURL, defaultGCOMDetectorsGetterTTL)
	if err != nil {
		return nil, fmt.Errorf("newGCOMDetectorsGetter: %w", err)
	}
	return &PatternsListInspector{
		detectorsGetter: sequenceDetectorsGetter{
			remoteGetter,
			newDefaultStaticDetectorsGetter(),
		},
	}, nil
}

func ProvideInspector(cfg *config.Cfg) (Inspector, error) {
	return newDefaultInspector(cfg)
}
