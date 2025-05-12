package aggregatorrunner

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	genericapiserver "k8s.io/apiserver/pkg/server"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
)

type NoopAggregatorConfigurator struct {
}

func (n NoopAggregatorConfigurator) Configure(opts *options.Options, config *genericapiserver.RecommendedConfig, delegateAPIServer genericapiserver.DelegationTarget, scheme *runtime.Scheme, builders []builder.APIGroupBuilder) (*genericapiserver.GenericAPIServer, error) {
	return nil, nil
}

func (n NoopAggregatorConfigurator) Run(ctx context.Context, transport *options.RoundTripperFunc, stoppedCh chan error) (*genericapiserver.GenericAPIServer, error) {
	return nil, nil
}

func ProvideNoopAggregatorConfigurator() AggregatorRunner {
	return &NoopAggregatorConfigurator{}
}
