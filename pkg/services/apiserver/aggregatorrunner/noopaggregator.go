package aggregatorrunner

import "github.com/grafana/grafana/pkg/services/apiserver/runner"

type NoopAggregatorConfigurator struct {
}

func (c *NoopAggregatorConfigurator) GetExtraRunners() []runner.ExtraRunner {
	return nil
}

func ProvideNoopAggregatorConfigurator() (runner.ExtraRunnerConfigurator, error) {
	return &NoopAggregatorConfigurator{}, nil
}
