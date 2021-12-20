package tracing

import (
	"github.com/grafana/grafana/pkg/setting"
	"gopkg.in/ini.v1"
)

func InitializeTracerForTest() error {
	file := ini.Empty()
	_, err := file.NewSection("tracing.jaeger")
	if err != nil {
		return err
	}
	_, err = file.NewSection("tracing.opentelemetry.jaeger")
	if err != nil {
		return err
	}

	_, err = ProvideService(&setting.Cfg{Raw: file})
	if err != nil {
		return err
	}
	return nil
}
