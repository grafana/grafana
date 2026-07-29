package rulesync

import "errors"

// SyncReason categorises a sync failure. The snake_case value is the Prometheus
// `reason` metric label. Single source of truth: wrap errors in *SyncError,
// extract via reasonOf.
type SyncReason string

const (
	ReasonDatasourceLookup SyncReason = "datasource_lookup"
	ReasonRulerFetch       SyncReason = "ruler_fetch"
	// ReasonNotARuler: the datasource responded but not as a ruler config API
	// (see ErrNotARuler). Distinct from ReasonRulerFetch (fetch failure).
	ReasonNotARuler SyncReason = "not_a_ruler"
	ReasonConvert   SyncReason = "convert"
	ReasonSave      SyncReason = "save"
	ReasonPrune     SyncReason = "prune"
	// ReasonUnclassified is the safety net for errors not tagged with
	// *SyncError. Keeps Prometheus label cardinality bounded.
	ReasonUnclassified SyncReason = "unclassified"
)

func (r SyncReason) Label() string { return string(r) }

// SyncError tags an error with a SyncReason so callers can classify via
// errors.As without parsing messages.
type SyncError struct {
	Reason SyncReason
	Cause  error
}

func (e *SyncError) Error() string {
	if e.Cause == nil {
		return string(e.Reason)
	}
	return e.Cause.Error()
}

func (e *SyncError) Unwrap() error { return e.Cause }

// reasonOf extracts the SyncReason via errors.As. Returns ReasonUnclassified
// for un-tagged errors — keeps metric label cardinality bounded.
func reasonOf(err error) SyncReason {
	var se *SyncError
	if errors.As(err, &se) {
		return se.Reason
	}
	return ReasonUnclassified
}
