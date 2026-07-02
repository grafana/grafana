package rulesync

import (
	"errors"
	"time"

	alertingrulesv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
)

// configStatus and externalSyncOrigin alias the unwieldy codegen-emitted type
// names for the rules Config status, keeping call sites readable.
type configStatus = alertingrulesv0alpha1.ConfigStatus
type externalSyncOrigin = alertingrulesv0alpha1.ConfigV0alpha1StatusExternalRulerSyncOrigin

const (
	originAPI = alertingrulesv0alpha1.ConfigV0alpha1StatusExternalRulerSyncOriginApi
	originIni = alertingrulesv0alpha1.ConfigV0alpha1StatusExternalRulerSyncOriginIni
)

// conditionTypeExternalRulerSynced is feature-qualified (not bare "Synced") so
// future feature condition types can coexist on the same status.conditions[]
// without collision.
const conditionTypeExternalRulerSynced = "ExternalRulerSynced"

// conditionReasonSyncSucceeded is the success-branch condition reason. Failure
// reasons come from SyncReason.ConditionReason().
const conditionReasonSyncSucceeded = "SyncSucceeded"

// conditionReasonPromotionCommitted is the terminal success reason once the
// synced rules have been promoted to native Grafana rules and sync has stopped
// (the rule-side analogue of the Alertmanager sync's MergeCommitted).
const conditionReasonPromotionCommitted = "PromotionCommitted"

// conditionReasonNotConfigured: flag on, but no datasource configured. Writing
// it seeds the Config singleton (create-on-missing), mirroring the AM sync.
const conditionReasonNotConfigured = "NotConfigured"

// SyncReason categorises a sync failure. snake_case constant → Prometheus
// `reason` metric label; PascalCase via ConditionReason() → k8s Condition
// reason. Single source of truth: wrap errors in *SyncError, extract via
// reasonOf.
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

// computeSyncStatus maps a sync outcome (nil = success) to the
// ExternalRulerSynced condition and folds it into prev.
func computeSyncStatus(prev *alertingrulesv0alpha1.ConfigStatus, uid string, origin externalSyncOrigin, syncErr error, now time.Time) alertingrulesv0alpha1.ConfigStatus {
	if syncErr == nil {
		return buildSyncStatus(prev, uid, origin, alertingrulesv0alpha1.ConfigConditionStatusTrue, conditionReasonSyncSucceeded, "", now)
	}
	return buildSyncStatus(prev, uid, origin, alertingrulesv0alpha1.ConfigConditionStatusFalse, reasonOf(syncErr).ConditionReason(), syncErr.Error(), now)
}

// computePromotedStatus is the terminal status once the synced rules have been
// promoted to native Grafana rules: the condition stays True (the rules exist
// and are owned by the org), the reason flips to PromotionCommitted, and sync
// stops.
func computePromotedStatus(prev *alertingrulesv0alpha1.ConfigStatus, uid string, origin externalSyncOrigin, now time.Time) alertingrulesv0alpha1.ConfigStatus {
	return buildSyncStatus(prev, uid, origin, alertingrulesv0alpha1.ConfigConditionStatusTrue, conditionReasonPromotionCommitted, "rules promoted to native Grafana rules; sync stopped", now)
}

// computeNotConfiguredStatus updates only the ExternalRulerSynced condition to
// Unknown/NotConfigured, preserving prev; transition-only timestamp.
func computeNotConfiguredStatus(prev *alertingrulesv0alpha1.ConfigStatus, now time.Time) alertingrulesv0alpha1.ConfigStatus {
	st := alertingrulesv0alpha1.ConfigStatus{}
	if prev != nil {
		st = *prev
		st.Conditions = append([]alertingrulesv0alpha1.ConfigCondition(nil), prev.Conditions...)
	}

	synced := alertingrulesv0alpha1.ConfigCondition{
		Type:               conditionTypeExternalRulerSynced,
		Status:             alertingrulesv0alpha1.ConfigConditionStatusUnknown,
		LastTransitionTime: now.UTC().Format(time.RFC3339),
		Reason:             conditionReasonNotConfigured,
	}
	for i, c := range st.Conditions {
		if c.Type == conditionTypeExternalRulerSynced {
			if c.Status == alertingrulesv0alpha1.ConfigConditionStatusUnknown {
				synced.LastTransitionTime = c.LastTransitionTime // no flip → keep timestamp
			}
			st.Conditions[i] = synced
			return st
		}
	}
	st.Conditions = append(st.Conditions, synced)
	return st
}

// buildSyncStatus folds an ExternalRulerSynced condition into prev. k8s
// condition FSM: lastTransitionTime advances only on a status flip. Preserves
// other condition types so future controllers aren't clobbered, and preserves
// the operator-status fields the codegen adds to ConfigStatus.
func buildSyncStatus(prev *alertingrulesv0alpha1.ConfigStatus, uid string, origin externalSyncOrigin, condStatus alertingrulesv0alpha1.ConfigConditionStatus, reason, message string, now time.Time) alertingrulesv0alpha1.ConfigStatus {
	uidCopy := uid
	originCopy := origin

	st := alertingrulesv0alpha1.ConfigStatus{
		ExternalRulerSync: &alertingrulesv0alpha1.ConfigV0alpha1StatusExternalRulerSync{
			DatasourceUid: &uidCopy,
			Origin:        &originCopy,
		},
	}
	// Preserve codegen operator-status fields so a status write doesn't drop
	// state an operator may have recorded.
	if prev != nil {
		st.ObservedGeneration = prev.ObservedGeneration
		st.OperatorStates = prev.OperatorStates
		st.AdditionalFields = prev.AdditionalFields
	}

	// lastTransitionTime advances only when status flips.
	transitionTime := now.UTC().Format(time.RFC3339)
	for _, c := range prevConditions(prev) {
		if c.Type == conditionTypeExternalRulerSynced {
			if c.Status == condStatus {
				transitionTime = c.LastTransitionTime
			}
			break
		}
	}

	synced := alertingrulesv0alpha1.ConfigCondition{
		Type:               conditionTypeExternalRulerSynced,
		Status:             condStatus,
		LastTransitionTime: transitionTime,
		Reason:             reason,
	}
	if message != "" {
		synced.Message = &message
	}

	// Preserve other condition types, then upsert Synced.
	for _, c := range prevConditions(prev) {
		if c.Type != conditionTypeExternalRulerSynced {
			st.Conditions = append(st.Conditions, c)
		}
	}
	st.Conditions = append(st.Conditions, synced)

	return st
}

func prevConditions(prev *alertingrulesv0alpha1.ConfigStatus) []alertingrulesv0alpha1.ConfigCondition {
	if prev == nil {
		return nil
	}
	return prev.Conditions
}
