package legacy

import (
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/prometheus/client_golang/prometheus"
)

type Client struct {
}

func ProvideAuthZClient(cfg *setting.Cfg, acSvc accesscontrol.Service, features *featuremgmt.FeatureManager,
	grpcServer grpcserver.Provider, registerer prometheus.Registerer, tracer tracing.Tracer) (*Client, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagAuthZGRPCServer) {
		return nil, nil
	}

	_, err := ProvideAuthZServer(cfg, acSvc, features, grpcServer, registerer, tracer)
	if err != nil {
		return nil, err
	}

	// TODO differentiate run local from run remote grpc

	return &Client{}, nil
}
