package rulesync

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	alertingrulesv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
)

func TestComputeSyncStatus_PreservesSiblingStatusFields(t *testing.T) {
	generation := int64(3)
	prev := &alertingrulesv0alpha1.ConfigStatus{
		ObservedGeneration: &generation,
		OperatorStates: map[string]alertingrulesv0alpha1.ConfigstatusOperatorState{
			"other-controller": {LastEvaluation: "1", State: alertingrulesv0alpha1.ConfigStatusOperatorStateStateSuccess},
		},
		AdditionalFields: map[string]interface{}{"foo": "bar"},
		Conditions: []alertingrulesv0alpha1.ConfigCondition{
			{Type: "SomeOtherCondition", Status: alertingrulesv0alpha1.ConfigConditionStatusTrue, Reason: "unrelated"},
		},
	}

	t.Run("success path", func(t *testing.T) {
		got := computeSyncStatus(prev, "ds1", originAPI, nil, time.Now(), "hash-1", "")
		assertSiblingFieldsPreserved(t, prev, &got)
	})

	t.Run("failure path", func(t *testing.T) {
		got := computeSyncStatus(prev, "ds1", originAPI, errors.New("boom"), time.Now(), "", "")
		assertSiblingFieldsPreserved(t, prev, &got)
	})
}

func assertSiblingFieldsPreserved(t *testing.T, prev, got *alertingrulesv0alpha1.ConfigStatus) {
	t.Helper()
	require.NotNil(t, got.ObservedGeneration)
	assert.Equal(t, *prev.ObservedGeneration, *got.ObservedGeneration, "observedGeneration must not be dropped")
	assert.Equal(t, prev.OperatorStates, got.OperatorStates, "operatorStates must not be dropped")
	assert.Equal(t, prev.AdditionalFields, got.AdditionalFields, "additionalFields must not be dropped")

	var foundOther, foundSynced bool
	for _, c := range got.Conditions {
		if c.Type == "SomeOtherCondition" {
			foundOther = true
		}
		if c.Type == conditionTypeExternalRulerSynced {
			foundSynced = true
		}
	}
	assert.True(t, foundOther, "a sibling condition type must not be dropped")
	assert.True(t, foundSynced, "the ExternalRulerSynced condition must be upserted, not just appended blindly")
	assert.Len(t, got.Conditions, 2, "Synced must be upserted in place, not duplicated")
}

func TestComputeUnchangedStatus_OnlyClearsFailuresFromBeforeTheApply(t *testing.T) {
	withReason := func(status alertingrulesv0alpha1.ConfigConditionStatus, reason string) *alertingrulesv0alpha1.ConfigStatus {
		return &alertingrulesv0alpha1.ConfigStatus{Conditions: []alertingrulesv0alpha1.ConfigCondition{
			{Type: conditionTypeExternalRulerSynced, Status: status, Reason: reason},
		}}
	}
	tests := []struct {
		name  string
		prev  *alertingrulesv0alpha1.ConfigStatus
		clear bool
	}{
		{"no status", nil, true},
		{"no condition", &alertingrulesv0alpha1.ConfigStatus{}, true},
		{"unknown", withReason(alertingrulesv0alpha1.ConfigConditionStatusUnknown, conditionReasonNotConfigured), true},
		{"datasource lookup", withReason(alertingrulesv0alpha1.ConfigConditionStatusFalse, ReasonDatasourceLookup.ConditionReason()), true},
		{"ruler fetch", withReason(alertingrulesv0alpha1.ConfigConditionStatusFalse, ReasonRulerFetch.ConditionReason()), true},
		{"not a ruler", withReason(alertingrulesv0alpha1.ConfigConditionStatusFalse, ReasonNotARuler.ConditionReason()), true},
		{"save", withReason(alertingrulesv0alpha1.ConfigConditionStatusFalse, ReasonSave.ConditionReason()), false},
		{"prune", withReason(alertingrulesv0alpha1.ConfigConditionStatusFalse, ReasonPrune.ConditionReason()), false},
		{"panic", withReason(alertingrulesv0alpha1.ConfigConditionStatusFalse, ReasonPanic.ConditionReason()), false},
		{"unclassified", withReason(alertingrulesv0alpha1.ConfigConditionStatusFalse, ReasonUnclassified.ConditionReason()), false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := computeUnchangedStatus(tc.prev, "ds1", originAPI, time.Now(), "42")

			cond := got.Conditions[0]
			if tc.clear {
				assert.Equal(t, alertingrulesv0alpha1.ConfigConditionStatusTrue, cond.Status)
				return
			}
			assert.Equal(t, alertingrulesv0alpha1.ConfigConditionStatusFalse, cond.Status)
			assert.Equal(t, tc.prev.Conditions[0].Reason, cond.Reason)
		})
	}
}

func TestComputeStatus_RootFolderUIDSurvivesSkipsAndDedupInvalidatingFailures(t *testing.T) {
	recorded := func(reason SyncReason) *alertingrulesv0alpha1.ConfigStatus {
		ds, root, hash := "ds1", "root-1", "old-hash"
		return &alertingrulesv0alpha1.ConfigStatus{
			ExternalRulerSync: &alertingrulesv0alpha1.ConfigV0alpha1StatusExternalRulerSync{
				DatasourceUid:   &ds,
				RootFolderUid:   &root,
				LastAppliedHash: &hash,
			},
			Conditions: []alertingrulesv0alpha1.ConfigCondition{
				{Type: conditionTypeExternalRulerSynced, Status: alertingrulesv0alpha1.ConfigConditionStatusFalse, Reason: reason.ConditionReason()},
			},
		}
	}

	t.Run("a skip that clears a pre-apply failure keeps the folder", func(t *testing.T) {
		got := computeUnchangedStatus(recorded(ReasonRulerFetch), "ds1", originAPI, time.Now(), "42")

		require.Equal(t, alertingrulesv0alpha1.ConfigConditionStatusTrue, got.Conditions[0].Status)
		require.NotNil(t, got.ExternalRulerSync.RootFolderUid)
		assert.Equal(t, "root-1", *got.ExternalRulerSync.RootFolderUid)
	})

	for _, reason := range []SyncReason{ReasonSave, ReasonPrune, ReasonPanic} {
		t.Run("a "+reason.Label()+" failure drops the hash but keeps the folder", func(t *testing.T) {
			got := computeSyncStatus(recorded(ReasonRulerFetch), "ds1", originAPI, &SyncError{Reason: reason, Cause: errors.New("boom")}, time.Now(), "", "")

			require.NotNil(t, got.ExternalRulerSync)
			assert.Nil(t, got.ExternalRulerSync.LastAppliedHash, "the dedup hash must not survive a failed apply")
			require.NotNil(t, got.ExternalRulerSync.RootFolderUid)
			assert.Equal(t, "root-1", *got.ExternalRulerSync.RootFolderUid)
		})
	}
}
