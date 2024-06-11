package authz

import (
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
)

type Client interface {
	// TODO
}

type LegacyClient struct {
}

func ProvideAuthZClient(
	cfg *setting.Cfg, acSvc accesscontrol.Service, features *featuremgmt.FeatureManager,
	grpcServer grpcserver.Provider, registerer prometheus.Registerer, tracer tracing.Tracer,
) (Client, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagAuthZGRPCServer) {
		return nil, nil
	}

	_, err := newLegacyServer(acSvc, features, grpcServer, tracer)
	if err != nil {
		return nil, err
	}

	// TODO differentiate run local from run remote grpc
	return &LegacyClient{}, nil
}
