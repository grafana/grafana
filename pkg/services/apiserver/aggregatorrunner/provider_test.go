package aggregatorrunner

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNoopAggregatorRunnerProvider_NewWithOptions(t *testing.T) {
	provider := NewNoopAggregatorRunnerProvider()
	require.NotNil(t, provider)

	runner, err := provider.NewWithOptions()
	require.NoError(t, err)
	require.NotNil(t, runner)

	// Should return a NoopAggregatorConfigurator
	_, ok := runner.(*NoopAggregatorConfigurator)
	assert.True(t, ok, "expected NoopAggregatorConfigurator")
}

// TestAggregatorRunnerProvider_Interface verifies that NoopAggregatorRunnerProvider
// implements the AggregatorRunnerProvider interface
func TestAggregatorRunnerProvider_Interface(t *testing.T) {
	var _ AggregatorRunnerProvider = &NoopAggregatorRunnerProvider{}
}

// TestNoopAggregatorConfigurator_ImplementsAggregatorRunner verifies that
// NoopAggregatorConfigurator implements the AggregatorRunner interface
func TestNoopAggregatorConfigurator_ImplementsAggregatorRunner(t *testing.T) {
	var _ AggregatorRunner = &NoopAggregatorConfigurator{}
}
