package v0alpha1

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAlertRuleQualityPolicyUnmarshalLegacyRequirements(t *testing.T) {
	data := []byte(`{
		"apiVersion": "alertrulequality.alerting.grafana.app/v0alpha1",
		"kind": "AlertRuleQualityPolicy",
		"metadata": {"name": "default", "resourceVersion": "123"},
		"spec": {
			"requiredAnnotations": ["summary", "runbook_url"],
			"requiredLabels": ["team"]
		}
	}`)

	var policy AlertRuleQualityPolicy
	require.NoError(t, json.Unmarshal(data, &policy))
	require.Equal(t, "default", policy.Name)
	require.Equal(t, "123", policy.ResourceVersion)
	require.Equal(t, AlertRuleQualityPolicySpec{
		RequiredAnnotations: []FieldRequirement{{Key: "summary", Enforce: true}, {Key: "runbook_url", Enforce: true}},
		RequiredLabels:      []FieldRequirement{{Key: "team", Enforce: true}},
	}, policy.Spec)

	encoded, err := json.Marshal(policy.Spec)
	require.NoError(t, err)
	require.JSONEq(t, `{
		"requiredAnnotations": [{"key": "summary", "enforce": true}, {"key": "runbook_url", "enforce": true}],
		"requiredLabels": [{"key": "team", "enforce": true}]
	}`, string(encoded))
}

func TestFieldRequirementUnmarshalJSON(t *testing.T) {
	for _, tc := range []struct {
		name string
		data string
		want FieldRequirement
	}{
		{
			name: "legacy string with whitespace",
			data: `  "summary"  `,
			want: FieldRequirement{Key: "summary", Enforce: true},
		},
		{
			name: "legacy escaped key",
			data: `"team\u005fowner"`,
			want: FieldRequirement{Key: "team_owner", Enforce: true},
		},
		{
			name: "object defaults to soft enforcement",
			data: `{"key": "summary"}`,
			want: FieldRequirement{Key: "summary"},
		},
		{
			name: "object with explicit soft enforcement",
			data: `{"key": "summary", "enforce": false}`,
			want: FieldRequirement{Key: "summary"},
		},
		{
			name: "object with enforcement enabled",
			data: `{"key": "summary", "enforce": true}`,
			want: FieldRequirement{Key: "summary", Enforce: true},
		},
		{
			name: "null retains zero value",
			data: `null`,
			want: FieldRequirement{},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var requirement FieldRequirement
			require.NoError(t, json.Unmarshal([]byte(tc.data), &requirement))
			require.Equal(t, tc.want, requirement)
		})
	}
}

func TestFieldRequirementUnmarshalJSONRejectsMalformedInput(t *testing.T) {
	for _, data := range []string{
		`42`,
		`true`,
		`["summary"]`,
		`{"key": 42}`,
		`{"key": "summary", "enforce": "true"}`,
		`"unterminated`,
	} {
		t.Run(data, func(t *testing.T) {
			var requirement FieldRequirement
			require.Error(t, json.Unmarshal([]byte(data), &requirement))
		})
	}
}

func TestAlertRuleQualityPolicyUnmarshalMixedRequirements(t *testing.T) {
	var policy AlertRuleQualityPolicy
	require.NoError(t, json.Unmarshal([]byte(`{
		"spec": {
			"requiredAnnotations": ["summary", {"key": "description"}],
			"requiredLabels": [{"key": "team", "enforce": false}, "severity"]
		}
	}`), &policy))
	require.Equal(t, AlertRuleQualityPolicySpec{
		RequiredAnnotations: []FieldRequirement{{Key: "summary", Enforce: true}, {Key: "description"}},
		RequiredLabels:      []FieldRequirement{{Key: "team"}, {Key: "severity", Enforce: true}},
	}, policy.Spec)
}
