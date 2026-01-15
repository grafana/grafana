package featuremgmt

import (
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/assert"
)

func Test_StaticProviderIntegration(t *testing.T) {
	provider, err := newStaticProvider(nil, standardFeatureFlags)
	assert.NoError(t, err)

	err = openfeature.SetProviderAndWait(provider)
	assert.NoError(t, err)

	for _, flag := range standardFeatureFlags {
		result, err := openfeature.NewDefaultClient().BooleanValueDetails(t.Context(), flag.Name, false, openfeature.TransactionContext(t.Context()))
		require.NoError(t, err)

		expected := flag.Expression == "true"

		assert.Equal(t, expected, result.Value)
	}
}
