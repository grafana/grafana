package tracing

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	registry.RegisterService(&TracingService{})
}

type TracingService struct {
	typ                      string
	enabled                  bool
	address                  string
	customTags               map[string]string
	samplerType              string
	samplerParam             float64
	tracing128bit            bool
	log                      log.Logger
	closer                   io.Closer
	zipkinPropagation        bool
	disableSharedZipkinSpans bool

	Cfg *setting.Cfg `inject:""`
}

func (ts *TracingService) Init() error {
	ts.log = log.New("tracing")
	ts.parseSettings()

	if ts.enabled {
		return ts.initGlobalTracer()
	}

	return nil
}

func (ts *TracingService) parseSettings() {
	var tracing, err = ts.Cfg.Raw.GetSection("tracing")
	if err != nil {
		return
	}

	ts.typ = tracing.Key("type").MustString("jaeger")
	if ts.typ == "jaeger" {
		ts.parseSettingsJeager()
	} else if ts.typ == "zipkin" {
		ts.parseSettingsZipkin()
	}
}

func (ts *TracingService) initGlobalTracer() error {
	if ts.typ == "jaeger" {
		return ts.initGlobalTracerJeager()
	} else if ts.typ == "zipkin" {
		return ts.initGlobalTracerZipkin()
	}
	return fmt.Errorf("Unknown tracing type: %s", ts.typ)
}

func (ts *TracingService) Run(ctx context.Context) error {
	<-ctx.Done()

	if ts.closer != nil {
		ts.log.Info("Closing tracing")
		ts.closer.Close()
	}

	return nil
}

func splitTagSettings(input string) map[string]string {
	res := map[string]string{}

	tags := strings.Split(input, ",")
	for _, v := range tags {
		kv := strings.Split(v, ":")
		if len(kv) > 1 {
			res[kv[0]] = kv[1]
		}
	}

	return res
}
