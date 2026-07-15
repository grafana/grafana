package rulesync

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	alertingrulesv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
)

func findSyncedCondition(t *testing.T, st alertingrulesv0alpha1.ConfigStatus) alertingrulesv0alpha1.ConfigCondition {
	t.Helper()
	for _, c := range st.Conditions {
		if c.Type == conditionTypeExternalRulerSynced {
			return c
		}
	}
	t.Fatalf("ExternalRulerSynced condition not found")
	return alertingrulesv0alpha1.ConfigCondition{}
}

func TestReasonOf(t *testing.T) {
	assert.Equal(t, ReasonUnclassified, reasonOf(errors.New("bare")))
	assert.Equal(t, ReasonNotARuler, reasonOf(&SyncError{Reason: ReasonNotARuler, Cause: ErrNotARuler}))
	// Wrapped SyncError is still classified.
	assert.Equal(t, ReasonSave, reasonOf(&SyncError{Reason: ReasonSave, Cause: errors.New("db down")}))
}

func TestComputeSyncStatus_Success(t *testing.T) {
	now := time.Date(2026, 6, 29, 12, 0, 0, 0, time.UTC)
	st := computeSyncStatus(nil, "ds-uid", originIni, nil, now, "h-123")

	require.NotNil(t, st.ExternalRulerSync)
	assert.Equal(t, "ds-uid", *st.ExternalRulerSync.DatasourceUid)
	assert.Equal(t, originIni, *st.ExternalRulerSync.Origin)
	// The applied hash is persisted on success for cross-restart/replica dedup.
	require.NotNil(t, st.ExternalRulerSync.LastAppliedHash)
	assert.Equal(t, "h-123", *st.ExternalRulerSync.LastAppliedHash)

	cond := findSyncedCondition(t, st)
	assert.Equal(t, alertingrulesv0alpha1.ConfigConditionStatusTrue, cond.Status)
	assert.Equal(t, conditionReasonSyncSucceeded, cond.Reason)
	assert.Nil(t, cond.Message)
	assert.Equal(t, now.Format(time.RFC3339), cond.LastTransitionTime)
}

func TestComputeSyncStatus_Failure(t *testing.T) {
	now := time.Date(2026, 6, 29, 12, 0, 0, 0, time.UTC)
	st := computeSyncStatus(nil, "ds-uid", originAPI, &SyncError{Reason: ReasonNotARuler, Cause: ErrNotARuler}, now, "")

	cond := findSyncedCondition(t, st)
	assert.Equal(t, alertingrulesv0alpha1.ConfigConditionStatusFalse, cond.Status)
	assert.Equal(t, "NotARuler", cond.Reason)
	require.NotNil(t, cond.Message)
	assert.Contains(t, *cond.Message, "ruler config API")
}

func TestComputeSyncStatus_FailurePreservesLastAppliedHash(t *testing.T) {
	now := time.Now().UTC()
	ok := computeSyncStatus(nil, "ds", originAPI, nil, now, "h-1")
	require.NotNil(t, ok.ExternalRulerSync.LastAppliedHash)
	// A later failure must not clobber the last-applied hash, so we don't
	// needlessly re-apply (and churn) once the datasource recovers.
	failed := computeSyncStatus(&ok, "ds", originAPI, &SyncError{Reason: ReasonRulerFetch}, now, "")
	require.NotNil(t, failed.ExternalRulerSync.LastAppliedHash)
	assert.Equal(t, "h-1", *failed.ExternalRulerSync.LastAppliedHash)
}

func TestComputePromotedStatus_TerminalTrue(t *testing.T) {
	t0 := time.Date(2026, 6, 29, 12, 0, 0, 0, time.UTC)
	t1 := t0.Add(time.Hour)

	// A prior successful sync at t0.
	st0 := computeSyncStatus(nil, "ds", originAPI, nil, t0, "")
	// Promotion at t1 stays True (rules still exist, now owned), so the
	// transition time is preserved and only the reason flips.
	st1 := computePromotedStatus(&st0, "ds", originAPI, t1)

	cond := findSyncedCondition(t, st1)
	assert.Equal(t, alertingrulesv0alpha1.ConfigConditionStatusTrue, cond.Status)
	assert.Equal(t, conditionReasonPromotionCommitted, cond.Reason)
	assert.Equal(t, t0.Format(time.RFC3339), cond.LastTransitionTime, "stays True: transition time preserved")
	require.NotNil(t, cond.Message)
}

func TestBuildSyncStatus_TransitionTimeOnlyAdvancesOnFlip(t *testing.T) {
	t0 := time.Date(2026, 6, 29, 12, 0, 0, 0, time.UTC)
	t1 := t0.Add(time.Hour)

	// First success at t0.
	st0 := computeSyncStatus(nil, "ds", originAPI, nil, t0, "")
	// Second success at t1 — status stays True, so transition time is preserved.
	st1 := computeSyncStatus(&st0, "ds", originAPI, nil, t1, "")
	c1 := findSyncedCondition(t, st1)
	assert.Equal(t, alertingrulesv0alpha1.ConfigConditionStatusTrue, c1.Status)
	assert.Equal(t, t0.Format(time.RFC3339), c1.LastTransitionTime, "no flip: transition time preserved")

	// Now a failure at t1 — status flips to False, transition time advances.
	st2 := computeSyncStatus(&st1, "ds", originAPI, &SyncError{Reason: ReasonSave}, t1, "")
	c2 := findSyncedCondition(t, st2)
	assert.Equal(t, alertingrulesv0alpha1.ConfigConditionStatusFalse, c2.Status)
	assert.Equal(t, t1.Format(time.RFC3339), c2.LastTransitionTime, "flip: transition time advances")
}

func TestBuildSyncStatus_PreservesOtherConditionsAndOperatorFields(t *testing.T) {
	now := time.Now().UTC()
	gen := int64(7)
	prev := &alertingrulesv0alpha1.ConfigStatus{
		ObservedGeneration: &gen,
		OperatorStates:     map[string]alertingrulesv0alpha1.ConfigstatusOperatorState{"op": {LastEvaluation: "v1"}},
		Conditions: []alertingrulesv0alpha1.ConfigCondition{
			{Type: "SomeOtherFeature", Status: alertingrulesv0alpha1.ConfigConditionStatusTrue, Reason: "X"},
		},
	}

	st := computeSyncStatus(prev, "ds", originAPI, nil, now, "")

	// Operator/codegen fields preserved.
	require.NotNil(t, st.ObservedGeneration)
	assert.Equal(t, gen, *st.ObservedGeneration)
	assert.Contains(t, st.OperatorStates, "op")

	// Foreign condition preserved, Synced upserted.
	var hasOther, hasSynced bool
	for _, c := range st.Conditions {
		if c.Type == "SomeOtherFeature" {
			hasOther = true
		}
		if c.Type == conditionTypeExternalRulerSynced {
			hasSynced = true
		}
	}
	assert.True(t, hasOther, "foreign condition preserved")
	assert.True(t, hasSynced, "Synced condition present")
}
