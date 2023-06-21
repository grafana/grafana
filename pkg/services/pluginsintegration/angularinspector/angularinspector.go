package angularinspector

import (
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angularinspector"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

type Service struct {
	angularinspector.Inspector
}

func ProvideService(cfg *config.Cfg) (*Service, error) {
	var underlying angularinspector.Inspector
	var err error
	if cfg.Features != nil && cfg.Features.IsEnabled(featuremgmt.FlagPluginsDynamicAngularDetectionPatterns) {
		underlying, err = angularinspector.NewDynamicInspector(cfg)
	} else {
		underlying, err = angularinspector.NewStaticInspector()
	}
	if err != nil {
		return nil, err
	}
	return &Service{underlying}, nil
}
