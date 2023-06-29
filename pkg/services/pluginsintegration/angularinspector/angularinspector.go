package angularinspector

import (
	"fmt"

	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angularinspector"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	pAngularDetector "github.com/grafana/grafana/pkg/services/pluginsintegration/angulardetector"
)

type Service struct {
	angularinspector.Inspector
}

// newDynamicInspector returns the default dynamic Inspector, which is a PatternsListInspector that will:
//  1. Try to get the Angular detectors from GCOM
//  2. If it fails, it will use the static (hardcoded) detections provided by defaultDetectors.
func newDynamicInspector(cfg *config.Cfg) (angularinspector.Inspector, error) {
	dynamicProvider, err := pAngularDetector.NewGCOMDetectorsProvider(cfg.GrafanaComURL)
	if err != nil {
		return nil, fmt.Errorf("NewGCOMDetectorsProvider: %w", err)
	}
	return &angularinspector.PatternsListInspector{
		DetectorsProvider: angulardetector.SequenceDetectorsProvider{
			dynamicProvider,
			angularinspector.NewDefaultStaticDetectorsProvider(),
		},
	}, nil
}

func ProvideService(cfg *config.Cfg) (*Service, error) {
	var underlying angularinspector.Inspector
	var err error
	if cfg.Features != nil && cfg.Features.IsEnabled(featuremgmt.FlagPluginsDynamicAngularDetectionPatterns) {
		underlying, err = newDynamicInspector(cfg)
	} else {
		underlying, err = angularinspector.NewStaticInspector()
	}
	if err != nil {
		return nil, err
	}
	return &Service{underlying}, nil
}
