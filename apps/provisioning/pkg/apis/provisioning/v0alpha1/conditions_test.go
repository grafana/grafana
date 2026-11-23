package v0alpha1

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestConditionJSONMatchesMetav1(t *testing.T) {
	transition := metav1.NewTime(time.Date(2026, 11, 23, 18, 30, 15, 123456789, time.FixedZone("CET", 3600)))
	tests := map[string]metav1.Condition{
		"all fields set": {
			Type: ConditionTypeReady, Status: metav1.ConditionTrue, ObservedGeneration: 3,
			LastTransitionTime: transition, Reason: ReasonAvailable, Message: "ok",
		},
		"zero observedGeneration and lastTransitionTime": {
			Type: ConditionTypeReady, Status: metav1.ConditionFalse, Reason: ReasonInvalidSpec,
		},
	}
	for name, metaCondition := range tests {
		t.Run(name, func(t *testing.T) {
			want, err := json.Marshal(metaCondition)
			require.NoError(t, err)

			got, err := json.Marshal(ConditionFromMeta[ConnectionCondition](metaCondition))
			require.NoError(t, err)
			require.JSONEq(t, string(want), string(got))
			require.Equal(t, string(want), string(got), "key order must match too")

			var decoded ConnectionCondition
			require.NoError(t, json.Unmarshal(want, &decoded))
			reencoded, err := json.Marshal(decoded)
			require.NoError(t, err)
			require.Equal(t, string(want), string(reencoded), "stored metav1 JSON must round-trip unchanged")

			var wantMeta metav1.Condition
			require.NoError(t, json.Unmarshal(want, &wantMeta))
			require.Equal(t, wantMeta, ConditionToMeta(decoded))
		})
	}
}

func TestConditionsNilStaysNil(t *testing.T) {
	require.Nil(t, ConditionsToMeta[ConnectionCondition](nil))
	require.Nil(t, ConditionsFromMeta[ConnectionCondition](nil))

	b, err := json.Marshal(ConnectionStatus{})
	require.NoError(t, err)
	require.NotContains(t, string(b), "conditions")
}

func TestSetStatusCondition(t *testing.T) {
	var conditions []ConnectionCondition
	require.True(t, SetStatusCondition(&conditions, metav1.Condition{Type: ConditionTypeReady, Status: metav1.ConditionTrue, Reason: ReasonAvailable}))
	require.Len(t, conditions, 1)
	require.NotNil(t, conditions[0].LastTransitionTime, "meta.SetStatusCondition stamps new conditions")

	require.False(t, SetStatusCondition(&conditions, metav1.Condition{Type: ConditionTypeReady, Status: metav1.ConditionTrue, Reason: ReasonAvailable}))
}
