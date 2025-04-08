package aggregatorrunner

import "github.com/grafana/grafana/pkg/services/apiserver/options"

type NoopAggregatorConfigurator struct {
}

func (c *NoopAggregatorConfigurator) GetExtraRunners() []options.ExtraRunner {
	return nil
}

func ProvideNoopAggregatorConfigurator() (options.ExtraRunnerConfigurator, error) {
	return &NoopAggregatorConfigurator{}, nil
}
