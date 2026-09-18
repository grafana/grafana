package rulesync

import (
	"time"

	prommodel "github.com/prometheus/common/model"

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
)

// computeSyncStatus maps a sync outcome (nil = success) to the
// ExternalRulerSynced condition and folds it into prev. appliedHash is stored
// only on success (empty keeps whatever hash prev already carried), so a
// later restart or replica can skip an unchanged re-apply — see
// resolvedRulerSync.persistedHash.
func computeSyncStatus(prev *alertingrulesv0alpha1.ConfigStatus, uid string, origin externalSyncOrigin, syncErr error, now time.Time, appliedHash string) alertingrulesv0alpha1.ConfigStatus {
	if syncErr == nil {
		return buildSyncStatus(prev, uid, origin, alertingrulesv0alpha1.ConfigConditionStatusTrue, conditionReasonSyncSucceeded, "", now, appliedHash)
	}
	return buildSyncStatus(prev, uid, origin, alertingrulesv0alpha1.ConfigConditionStatusFalse, reasonOf(syncErr).ConditionReason(), syncErr.Error(), now, "")
}

// computeNotConfiguredStatus returns prev with only the ExternalRulerSynced
// condition updated to Unknown/NotConfigured (used when the API path is
// reachable but no datasourceUid is configured). externalRulerSync is left
// untouched -- it documents the last attempted sync, and there wasn't one.
func computeNotConfiguredStatus(prev *alertingrulesv0alpha1.ConfigStatus, now time.Time) alertingrulesv0alpha1.ConfigStatus {
	st := cloneStatus(prev)
	upsertSyncedCondition(&st, alertingrulesv0alpha1.ConfigCondition{
		Type:               conditionTypeExternalRulerSynced,
		Status:             alertingrulesv0alpha1.ConfigConditionStatusUnknown,
		LastTransitionTime: now.UTC().Format(time.RFC3339), // used only if this is a flip or first write
		Reason:             conditionReasonNotConfigured,
	})
	return st
}

// buildSyncStatus folds an ExternalRulerSynced condition into prev, plus the
// externalRulerSync context (datasource UID and origin) that produced it.
// appliedHash, when non-empty, overwrites the persisted dedup hash; when
// empty, prev's hash (if any) carries forward unchanged.
func buildSyncStatus(prev *alertingrulesv0alpha1.ConfigStatus, uid string, origin externalSyncOrigin, condStatus alertingrulesv0alpha1.ConfigConditionStatus, reason, message string, now time.Time, appliedHash string) alertingrulesv0alpha1.ConfigStatus {
	uidCopy := uid
	originCopy := origin
	st := cloneStatus(prev)
	hash := appliedHash
	if hash == "" && prev != nil && prev.ExternalRulerSync != nil && prev.ExternalRulerSync.LastAppliedHash != nil {
		hash = *prev.ExternalRulerSync.LastAppliedHash
	}
	st.ExternalRulerSync = &alertingrulesv0alpha1.ConfigV0alpha1StatusExternalRulerSync{
		DatasourceUid: &uidCopy,
		Origin:        &originCopy,
	}
	if hash != "" {
		st.ExternalRulerSync.LastAppliedHash = &hash
	}

	synced := alertingrulesv0alpha1.ConfigCondition{
		Type:               conditionTypeExternalRulerSynced,
		Status:             condStatus,
		LastTransitionTime: now.UTC().Format(time.RFC3339), // used only if this is a flip or first write
		Reason:             reason,
	}
	if message != "" {
		synced.Message = &message
	}
	upsertSyncedCondition(&st, synced)
	return st
}

// cloneStatus starts a new ConfigStatus from prev (or a zero value if prev is
// nil), deep-copying Conditions so the caller can mutate it without aliasing
// prev's slice. observedGeneration, operatorStates and additionalFields ride
// through unchanged -- those are fields another controller writing this same
// status object owns, not ours to drop.
func cloneStatus(prev *alertingrulesv0alpha1.ConfigStatus) alertingrulesv0alpha1.ConfigStatus {
	if prev == nil {
		return alertingrulesv0alpha1.ConfigStatus{}
	}
	st := *prev
	st.Conditions = append([]alertingrulesv0alpha1.ConfigCondition(nil), prev.Conditions...)
	return st
}

// upsertSyncedCondition writes synced into st.Conditions in place, appending
// it if no ExternalRulerSynced condition exists yet. synced.LastTransitionTime
// must already hold the time to use on a flip (or first write) -- it's
// overwritten with the existing condition's timestamp when the status hasn't
// changed, since k8s's condition FSM only advances lastTransitionTime on a
// flip.
func upsertSyncedCondition(st *alertingrulesv0alpha1.ConfigStatus, synced alertingrulesv0alpha1.ConfigCondition) {
	for i, c := range st.Conditions {
		if c.Type == conditionTypeExternalRulerSynced {
			if c.Status == synced.Status {
				synced.LastTransitionTime = c.LastTransitionTime
			}
			st.Conditions[i] = synced
			return
		}
	}
	st.Conditions = append(st.Conditions, synced)
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

// externalRulerSyncLastAppliedHashFromConfig returns the persisted dedup hash
// from status, or "" when any level in the nested optional chain is unset
// (never synced yet, or synced by a build that predates this field).
func externalRulerSyncLastAppliedHashFromConfig(c *alertingrulesv0alpha1.Config) string {
	if c == nil ||
		c.Status.ExternalRulerSync == nil ||
		c.Status.ExternalRulerSync.LastAppliedHash == nil {
		return ""
	}
	return *c.Status.ExternalRulerSync.LastAppliedHash
}

// externalRulerSyncPollIntervalFromConfig returns the configured poll interval,
// or defaultRulerSyncPollInterval when unset, unparseable (the CUE pattern
// already validates the string at admission time; this is a defensive
// fallback, not the primary guard), or c is nil.
func externalRulerSyncPollIntervalFromConfig(c *alertingrulesv0alpha1.Config) time.Duration {
	if c == nil ||
		c.Spec.ExternalRulerSync == nil ||
		c.Spec.ExternalRulerSync.PollInterval == nil {
		return defaultRulerSyncPollInterval
	}
	d, err := prommodel.ParseDuration(*c.Spec.ExternalRulerSync.PollInterval)
	if err != nil {
		return defaultRulerSyncPollInterval
	}
	return time.Duration(d)
}
