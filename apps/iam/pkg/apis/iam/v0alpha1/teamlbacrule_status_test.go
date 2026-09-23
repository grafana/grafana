package v0alpha1

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTeamLBACRuleStatusJSONRoundTrip(t *testing.T) {
	rule := NewTeamLBACRule()
	rule.Spec = TeamLBACRuleSpec{
		DatasourceUid:  "prometheus-uid",
		DatasourceType: "prometheus",
		TeamFilters: map[string][]string{
			"team-uid": {`environment="production"`},
		},
	}
	rule.Status.Conditions = []TeamLBACRuleCondition{{
		Type:   TeamLBACRuleConditionTypeEnforceable,
		Status: TeamLBACRuleConditionStatusFalse,
		Reason: TeamLBACRuleConditionReasonBasicAuthDisabled,
	}}

	encoded, err := json.Marshal(rule)
	require.NoError(t, err)

	var decoded TeamLBACRule
	require.NoError(t, json.Unmarshal(encoded, &decoded))
	require.Equal(t, rule.Spec, decoded.Spec)
	require.Equal(t, rule.Status, decoded.Status)
}

func TestTeamLBACRuleStatusAcceptsUnknownReason(t *testing.T) {
	var rule TeamLBACRule
	require.NoError(t, json.Unmarshal([]byte(`{
		"spec": {
			"datasource_uid": "prometheus-uid",
			"datasource_type": "prometheus",
			"team_filters": {}
		},
		"status": {
			"conditions": [{
				"type": "Enforceable",
				"status": "Unknown",
				"reason": "FutureReason"
			}]
		}
	}`), &rule))

	require.Equal(t, "FutureReason", rule.Status.Conditions[0].Reason)
}

func TestTeamLBACRuleStatusContractConstants(t *testing.T) {
	require.Equal(t, "Enforceable", TeamLBACRuleConditionTypeEnforceable)
	require.Equal(t, "Ready", TeamLBACRuleConditionReasonReady)
	require.Equal(t, "BasicAuthDisabled", TeamLBACRuleConditionReasonBasicAuthDisabled)
	require.Equal(t, "BasicAuthUserMissing", TeamLBACRuleConditionReasonBasicAuthUserMissing)
	require.Equal(t, "DatasourceNotFound", TeamLBACRuleConditionReasonDatasourceNotFound)
	require.Equal(t, "DatasourceLookupFailed", TeamLBACRuleConditionReasonDatasourceLookupFailed)
	require.Equal(t, "NamespaceResolutionFailed", TeamLBACRuleConditionReasonNamespaceResolutionFailed)
	require.Equal(t, "UnsupportedDatasourceType", TeamLBACRuleConditionReasonUnsupportedDatasourceType)
}

func TestTeamLBACRuleWithoutStatusRemainsDecodable(t *testing.T) {
	var rule TeamLBACRule
	require.NoError(t, json.Unmarshal([]byte(`{
		"spec": {
			"datasource_uid": "prometheus-uid",
			"datasource_type": "prometheus",
			"team_filters": {}
		}
	}`), &rule))

	require.Empty(t, rule.Status.Conditions)
}

func TestTeamLBACRuleExposesStatusSubresource(t *testing.T) {
	rule := NewTeamLBACRule()
	rule.Status.Conditions = []TeamLBACRuleCondition{{
		Type:   TeamLBACRuleConditionTypeEnforceable,
		Status: TeamLBACRuleConditionStatusTrue,
		Reason: TeamLBACRuleConditionReasonReady,
	}}

	status, ok := rule.GetSubresource("status")
	require.True(t, ok)
	require.Equal(t, rule.Status, status)
}
