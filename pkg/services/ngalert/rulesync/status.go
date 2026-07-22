package rulesync

import "errors"

// syncOrigin records where the effective sync datasource UID came from: the
// operator ini setting ("ini") or the per-org Config spec ("api").
type syncOrigin string

const (
	originAPI syncOrigin = "api"
	originIni syncOrigin = "ini"
)

// SyncReason categorises a sync failure. The snake_case value is the Prometheus
// `reason` metric label; ConditionReason maps it to the k8s Config condition
// reason. Single source of truth: wrap errors in *SyncError, extract via reasonOf.
type SyncReason string

const (
	ReasonDatasourceLookup SyncReason = "datasource_lookup"
	ReasonRulerFetch       SyncReason = "ruler_fetch"
	// ReasonNotARuler: the datasource did not respond as a ruler config API
	// (see ErrNotARuler). Distinct from ReasonRulerFetch (transient network).
	ReasonNotARuler SyncReason = "not_a_ruler"
	ReasonConvert   SyncReason = "convert"
	ReasonSave      SyncReason = "save"
	ReasonPrune     SyncReason = "prune"
	// ReasonPromote: promoting the synced rules to native Grafana rules failed.
	ReasonPromote SyncReason = "promote"
	// ReasonConfigRead: couldn't read the org's Config resource to resolve the
	// sync datasource; the tick is skipped and surfaced as a failure.
	ReasonConfigRead SyncReason = "config_read"
	// ReasonUnclassified is the safety net for errors not tagged with
	// *SyncError. Keeps Prometheus label cardinality bounded.
	ReasonUnclassified SyncReason = "unclassified"
)

func (r SyncReason) Label() string { return string(r) }

// ConditionReason maps a failure reason to the k8s Config condition reason. It
// is consumed by the Config status adapter (see the app-resource PR #127756);
// this package itself only records domain outcomes.
func (r SyncReason) ConditionReason() string {
	switch r {
	case ReasonDatasourceLookup:
		return "DatasourceLookupFailed"
	case ReasonRulerFetch:
		return "RulerFetchFailed"
	case ReasonNotARuler:
		return "NotARuler"
	case ReasonConvert:
		return "ConversionFailed"
	case ReasonSave:
		return "SaveFailed"
	case ReasonPrune:
		return "PruneFailed"
	case ReasonPromote:
		return "PromotionFailed"
	case ReasonConfigRead:
		return "ConfigReadFailed"
	default:
		return "SyncFailed"
	}
}

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

// outcomeState classifies a sync tick's result for the config store to record.
type outcomeState int

const (
	outcomeSuccess outcomeState = iota
	outcomeFailure
	outcomeNotConfigured
	outcomePromoted
)

// syncOutcome is the domain result of a sync tick, handed to the config store to
// persist as status. The k8s Config status FSM (conditions, transition times,
// operator-field preservation) lives in the Config store adapter in the
// app-resource PR (#127756), keeping this package free of the generated kind.
type syncOutcome struct {
	state         outcomeState
	datasourceUID string
	origin        syncOrigin
	reason        SyncReason // failure only
	errMsg        string     // failure only
	appliedHash   string     // success only; upstream hash for cross-restart dedup
}
