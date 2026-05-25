package state

// ReleaseEvictedStaleTransitionValueMaps drops large evaluation maps from transitions whose alert
// instances were evicted from the scheduler cache (missing series resolved to Normal with
// StateReasonMissingSeries).
//
// Call this only after ProcessEvalResults has finished persisting, recording history, and sending
// notifications — i.e. after the function returns — so downstream consumers have read Values /
// LatestResult.Values.
//
// Important: do not clear Values for transitions that still back in-cache alert instances:
// StateTransition embeds the same *State pointer that lives in the cache for active series.
// IsStale() is true only for evicted missing-series instances, so those are safe to release.
func ReleaseEvictedStaleTransitionValueMaps(transitions StateTransitions) {
	for i := range transitions {
		s := transitions[i].State
		if s == nil || !s.IsStale() {
			continue
		}
		s.Values = nil
		if s.LatestResult != nil {
			s.LatestResult.Values = nil
		}
	}
}
