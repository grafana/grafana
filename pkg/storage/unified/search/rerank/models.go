package rerank

// Canonical model identifiers, provider-prefixed like embedder.Embedder.Model.
const (
	ModelVertexSemanticRankerFast004 = "vertex/semantic-ranker-fast-004"
	ModelBedrockCohereRerankV35      = "bedrock/cohere.rerank-v3-5:0"
)

// ThresholdsForModel returns the calibrated thresholds for known models
// and the zero value (= no filtering) for everything else. Values are
// calibrated against SciFact at fixed target recalls; they come from the
// grafana-assistant-app calibration procedure and must be re-derived, not
// tweaked, if a model changes.
func ThresholdsForModel(model string) RelevanceThresholds {
	switch model {
	case ModelVertexSemanticRankerFast004:
		return RelevanceThresholds{
			Lowest:  0.040480,
			Low:     0.087970,
			Medium:  0.172740,
			High:    0.331500,
			Highest: 0.510220,
		}
	case ModelBedrockCohereRerankV35:
		return RelevanceThresholds{
			Lowest:  0.050855,
			Low:     0.136984,
			Medium:  0.323618,
			High:    0.567194,
			Highest: 0.800745,
		}
	default:
		return RelevanceThresholds{}
	}
}
