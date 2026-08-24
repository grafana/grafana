package rulesync

import (
	"time"

	alertingrulesv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
)

// externalSyncOrigin aliases the codegen-emitted enum for the auxiliary origin
// field on Config.status.externalRulerSync. The generated name is unwieldy in
// expressions; the alias keeps call sites readable without obscuring the
// underlying type.
type externalSyncOrigin = alertingrulesv0alpha1.ConfigV0alpha1StatusExternalRulerSyncOrigin

const (
	originAPI externalSyncOrigin = alertingrulesv0alpha1.ConfigV0alpha1StatusExternalRulerSyncOriginApi
	originIni externalSyncOrigin = alertingrulesv0alpha1.ConfigV0alpha1StatusExternalRulerSyncOriginIni
)

// conditionTypeExternalRulerSynced is feature-qualified (not bare "Synced") so
// future feature condition types can coexist on the same status.conditions[]
// without collision. Mirrors the external Alertmanager sync's
// conditionTypeExternalAlertmanagerSynced.
const conditionTypeExternalRulerSynced = "ExternalRulerSynced"

// ExternalRulerSynced condition reasons (failure reasons come from
// SyncReason.ConditionReason()).
const (
	conditionReasonSyncSucceeded = "SyncSucceeded"
	conditionReasonNotConfigured = "NotConfigured"
	// conditionReasonPromoted is the terminal reason once promote-to-native has
	// committed: the rules the syncer owned are handed to the user and sync stops.
	conditionReasonPromoted = "PromotionCommitted"
)

const promotedMessage = "The externally-synced rules have been promoted to user-editable native rules; automatic sync from the datasource has stopped."

// computeSyncStatus maps a sync outcome (nil = success) to the
// ExternalRulerSynced condition and folds it into prev.
func computeSyncStatus(prev *alertingrulesv0alpha1.ConfigStatus, uid string, origin externalSyncOrigin, syncErr error, now time.Time) alertingrulesv0alpha1.ConfigStatus {
	if syncErr == nil {
		return buildSyncStatus(prev, uid, origin, alertingrulesv0alpha1.ConfigConditionStatusTrue, conditionReasonSyncSucceeded, "", now)
	}
	return buildSyncStatus(prev, uid, origin, alertingrulesv0alpha1.ConfigConditionStatusFalse, reasonOf(syncErr).ConditionReason(), syncErr.Error(), now)
}

// computePromotedStatus is the terminal status once promote-to-native has
// committed: stays True (so the synced-at timestamp is kept), reason flips to
// PromotionCommitted.
func computePromotedStatus(prev *alertingrulesv0alpha1.ConfigStatus, uid string, origin externalSyncOrigin, now time.Time) alertingrulesv0alpha1.ConfigStatus {
	return buildSyncStatus(prev, uid, origin, alertingrulesv0alpha1.ConfigConditionStatusTrue, conditionReasonPromoted, promotedMessage, now)
}

// computeNotConfiguredStatus returns prev with only the ExternalRulerSynced
// condition updated to Unknown/NotConfigured (used when the API path is
// reachable — the alerting.syncExternalRuler flag is on — but no datasourceUid
// is configured). Everything else rides through unchanged: observedGeneration,
// externalRulerSync (kept as the last-attempt context, its documented meaning)
// and any sibling conditions. The Synced condition is a current-state snapshot,
// and its lastTransitionTime advances only on a flip to Unknown, so consecutive
// not-configured ticks produce an identical status that dedups to no write.
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
				synced.LastTransitionTime = c.LastTransitionTime // no flip -> keep the timestamp
			}
			st.Conditions[i] = synced
			return st
		}
	}
	st.Conditions = append(st.Conditions, synced)
	return st
}

// buildSyncStatus folds an ExternalRulerSynced condition into prev. k8s
// condition FSM: lastTransitionTime advances only on status flip. Preserves
// other condition types so future controllers aren't clobbered.
func buildSyncStatus(prev *alertingrulesv0alpha1.ConfigStatus, uid string, origin externalSyncOrigin, condStatus alertingrulesv0alpha1.ConfigConditionStatus, reason, message string, now time.Time) alertingrulesv0alpha1.ConfigStatus {
	uidCopy := uid
	originCopy := origin
	st := alertingrulesv0alpha1.ConfigStatus{
		ExternalRulerSync: &alertingrulesv0alpha1.ConfigV0alpha1StatusExternalRulerSync{
			DatasourceUid: &uidCopy,
			Origin:        &originCopy,
		},
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

// externalRulerSyncDatasourceUIDFromConfig returns the configured UID or ""
// when any level in the nested optional chain is unset.
func externalRulerSyncDatasourceUIDFromConfig(c *alertingrulesv0alpha1.Config) string {
	if c == nil ||
		c.Spec.ExternalRulerSync == nil ||
		c.Spec.ExternalRulerSync.DatasourceUid == nil {
		return ""
	}
	return *c.Spec.ExternalRulerSync.DatasourceUid
}

// externalRulerSyncTargetDatasourceUIDFromConfig returns the configured
// recording-rules target datasource UID or "" when any level in the nested
// optional chain is unset (callers default to the query datasource).
func externalRulerSyncTargetDatasourceUIDFromConfig(c *alertingrulesv0alpha1.Config) string {
	if c == nil ||
		c.Spec.ExternalRulerSync == nil ||
		c.Spec.ExternalRulerSync.TargetDatasourceUid == nil {
		return ""
	}
	return *c.Spec.ExternalRulerSync.TargetDatasourceUid
}
