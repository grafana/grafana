package angularinspector

import (
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angularinspector"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/angulardetectorsprovider"
)

type Service struct {
	angularinspector.Inspector
}

func ProvideService(features featuremgmt.FeatureToggles, dynamic *angulardetectorsprovider.Dynamic) (*Service, error) {
	var detectorsProvider angulardetector.DetectorsProvider
	var err error
	static := angularinspector.NewDefaultStaticDetectorsProvider()
	if features.IsEnabledGlobally(featuremgmt.FlagPluginsDynamicAngularDetectionPatterns) {
		detectorsProvider = angulardetector.SequenceDetectorsProvider{dynamic, static}
	} else {
		detectorsProvider = static
	}
	if err != nil {
		return nil, err
	}
	return &Service{Inspector: angularinspector.NewPatternListInspector(detectorsProvider)}, nil
}
