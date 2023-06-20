package angularinspector

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
)

type Static struct {
	detectorsProvider angulardetector.DetectorsProvider
}

func (p *Static) ProvideDetectors(ctx context.Context) []angulardetector.Detector {
	return p.detectorsProvider.ProvideDetectors(ctx)
}

func ProvideService() angulardetector.DetectorsProvider {
	return &Static{detectorsProvider: angulardetector.NewDefaultStaticDetectorsProvider()}
}
