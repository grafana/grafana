package rerank

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseRelevance(t *testing.T) {
	for _, ok := range []string{"lowest", "low", "medium", "high", "highest"} {
		r, err := ParseRelevance(ok)
		require.NoError(t, err)
		assert.Equal(t, Relevance(ok), r)
	}
	for _, bad := range []string{"", "Low", "med", "none", "0.5"} {
		_, err := ParseRelevance(bad)
		assert.Error(t, err, "value %q", bad)
	}
}

func TestRelevanceThresholds_Resolve(t *testing.T) {
	th := RelevanceThresholds{Lowest: 0.1, Low: 0.2, Medium: 0.3, High: 0.4, Highest: 0.5}
	assert.Equal(t, 0.1, th.Resolve(RelevanceLowest))
	assert.Equal(t, 0.2, th.Resolve(RelevanceLow))
	assert.Equal(t, 0.3, th.Resolve(RelevanceMedium))
	assert.Equal(t, 0.4, th.Resolve(RelevanceHigh))
	assert.Equal(t, 0.5, th.Resolve(RelevanceHighest))
	// empty/unknown = 0 = no filtering
	assert.Zero(t, th.Resolve(""))
	assert.Zero(t, th.Resolve("bogus"))
	// uncalibrated zero-value struct = 0 at every level
	assert.Zero(t, RelevanceThresholds{}.Resolve(RelevanceHigh))
}

func TestThresholdsForModel(t *testing.T) {
	v := ThresholdsForModel(ModelVertexSemanticRankerFast004)
	assert.Equal(t, 0.087970, v.Low)
	assert.Equal(t, 0.510220, v.Highest)

	b := ThresholdsForModel(ModelBedrockCohereRerankV35)
	assert.Equal(t, 0.136984, b.Low)
	assert.Equal(t, 0.050855, b.Lowest)

	// unknown model = uncalibrated = zero-value (no filtering)
	assert.Zero(t, ThresholdsForModel("vertex/some-new-model"))
}
