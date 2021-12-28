package tracing

import (
	"github.com/grafana/grafana/pkg/setting"
	"gopkg.in/ini.v1"
)

func InitializeTracerForTest() (TracerService, error) {
	file := ini.Empty()
	_, err := file.NewSection("tracing.jaeger")
	if err != nil {
		return nil, err
	}
	_, err = file.NewSection("tracing.opentelemetry.jaeger")
	if err != nil {
		return nil, err
	}

	tracer, err := ProvideService(&setting.Cfg{Raw: file})
	if err != nil {
		return nil, err
	}
	return tracer, nil
}
