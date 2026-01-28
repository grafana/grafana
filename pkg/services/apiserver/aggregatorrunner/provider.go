package aggregatorrunner

// AggregatorRunnerProvider provides AggregatorRunner instances.
// This enables dependency injection and testability by allowing mock
// implementations to be injected during tests.
//
// The production implementation is in the enterprise package:
// pkg/extensions/embeddedapiserver/aggregatorrunner/provider.go
type AggregatorRunnerProvider interface {
	// NewWithOptions creates a new AggregatorRunner.
	// The returned runner can be configured via Configure() and then run via Run().
	NewWithOptions() (AggregatorRunner, error)
}

// NoopAggregatorRunnerProvider is a no-op implementation for OSS builds
// or when aggregation is not needed.
type NoopAggregatorRunnerProvider struct{}

// NewNoopAggregatorRunnerProvider creates a new NoopAggregatorRunnerProvider.
func NewNoopAggregatorRunnerProvider() *NoopAggregatorRunnerProvider {
	return &NoopAggregatorRunnerProvider{}
}

// NewWithOptions returns a NoopAggregatorConfigurator.
func (p *NoopAggregatorRunnerProvider) NewWithOptions() (AggregatorRunner, error) {
	return &NoopAggregatorConfigurator{}, nil
}
