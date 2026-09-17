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
		got := computeSyncStatus(prev, "ds1", originAPI, nil, time.Now())
		assertSiblingFieldsPreserved(t, prev, &got)
	})

	t.Run("failure path", func(t *testing.T) {
		got := computeSyncStatus(prev, "ds1", originAPI, errors.New("boom"), time.Now())
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
