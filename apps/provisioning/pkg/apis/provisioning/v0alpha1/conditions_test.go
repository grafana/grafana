package v0alpha1

import (
	"encoding/json"
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"
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

func TestValidateConditions(t *testing.T) {
	path := field.NewPath("status", "conditions")
	tests := map[string]struct {
		timestamp *string
		wantErr   bool
	}{
		"unset":               {timestamp: nil},
		"UTC":                 {timestamp: new("2026-01-02T03:04:05Z")},
		"offset and fraction": {timestamp: new("2026-01-02T03:04:05.123+01:00")},
		"empty":               {timestamp: new(""), wantErr: true},
		"not a timestamp":     {timestamp: new("yesterday"), wantErr: true},
	}
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			conditions := []ConnectionCondition{{Type: ConditionTypeReady}, {Type: "Other", LastTransitionTime: tt.timestamp}}
			list := ValidateConditions(path, conditions)
			if !tt.wantErr {
				require.Empty(t, list)
				return
			}
			require.Len(t, list, 1)
			require.Equal(t, "status.conditions[1].lastTransitionTime", list[0].Field)
			require.Equal(t, field.ErrorTypeInvalid, list[0].Type)
		})
	}
}

func TestNormalizeConditions(t *testing.T) {
	t.Run("rewrites in the metav1.Condition encoding", func(t *testing.T) {
		got := NormalizeConditions([]ConnectionCondition{{
			Type: ConditionTypeReady, Status: "True", ObservedGeneration: new(int64(0)),
			LastTransitionTime: new("2026-01-02T03:04:05.123+01:00"),
		}})
		require.Equal(t, []ConnectionCondition{{
			Type: ConditionTypeReady, Status: "True", LastTransitionTime: new("2026-01-02T02:04:05Z"),
		}}, got)
	})
	t.Run("leaves invalid conditions for validation to reject", func(t *testing.T) {
		in := []ConnectionCondition{
			{Type: ConditionTypeReady, ObservedGeneration: new(int64(0))},
			{Type: "Other", LastTransitionTime: new("yesterday")},
		}
		require.Equal(t, in, NormalizeConditions(slices.Clone(in)))
	})
	t.Run("nil stays nil", func(t *testing.T) {
		require.Nil(t, NormalizeConditions[ConnectionCondition](nil))
	})
}
