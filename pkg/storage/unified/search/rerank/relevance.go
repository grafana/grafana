package rerank

import "fmt"

// Relevance is a model-agnostic relevance threshold label. Each label
// targets a recall level — the fraction of truly relevant documents that
// survive the threshold filter. The actual score cutoff is model-specific
// (see models.go).
type Relevance string

const (
	RelevanceLowest  Relevance = "lowest"  // ~95% recall
	RelevanceLow     Relevance = "low"     // ~85% recall
	RelevanceMedium  Relevance = "medium"  // ~70% recall
	RelevanceHigh    Relevance = "high"    // ~50% recall
	RelevanceHighest Relevance = "highest" // ~30% recall
)

// ParseRelevance converts a string to a Relevance value, erroring on
// unknown values. The empty string is NOT valid here — callers that treat
// empty as "no filtering" must check before parsing.
func ParseRelevance(s string) (Relevance, error) {
	switch Relevance(s) {
	case RelevanceLowest, RelevanceLow, RelevanceMedium, RelevanceHigh, RelevanceHighest:
		return Relevance(s), nil
	default:
		return "", fmt.Errorf("unknown relevance level: %q", s)
	}
}

// RelevanceThresholds holds model-specific score thresholds per level,
// derived by calibration against an IR benchmark (percentiles of relevant
// document scores).
type RelevanceThresholds struct {
	Lowest  float64 // 5th percentile of relevant scores
	Low     float64 // 15th percentile
	Medium  float64 // 30th percentile
	High    float64 // 50th percentile (median)
	Highest float64 // 70th percentile
}

// Resolve returns the score threshold for a level. Returns 0 for an empty
// or unknown level, or when the thresholds are uncalibrated (zero-value
// struct). Callers treat 0 as "no filtering" — calibrated thresholds are
// always positive.
func (t RelevanceThresholds) Resolve(level Relevance) float64 {
	switch level {
	case RelevanceLowest:
		return t.Lowest
	case RelevanceLow:
		return t.Low
	case RelevanceMedium:
		return t.Medium
	case RelevanceHigh:
		return t.High
	case RelevanceHighest:
		return t.Highest
	default:
		return 0
	}
}
