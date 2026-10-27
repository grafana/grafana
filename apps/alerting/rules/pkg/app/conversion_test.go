package app

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
)

func convertRaw(t *testing.T, in string, target string) map[string]any {
	t.Helper()
	out, err := ruleConverter{}.Convert(k8s.RawKind{Raw: []byte(in)}, target)
	require.NoError(t, err)
	var got map[string]any
	require.NoError(t, json.Unmarshal(out, &got))
	return got
}

func notificationSettings(t *testing.T, obj map[string]any) map[string]any {
	t.Helper()
	spec, ok := obj["spec"].(map[string]any)
	require.True(t, ok)
	settings, ok := spec["notificationSettings"].(map[string]any)
	require.True(t, ok)
	return settings
}

func TestRuleConverter(t *testing.T) {
	v0 := v0alpha1.GroupVersion.String()
	v1 := v1beta1.GroupVersion.String()

	t.Run("sets the target apiVersion", func(t *testing.T) {
		got := convertRaw(t, `{"apiVersion":"`+v0+`","kind":"RecordingRule","spec":{"metric":"m"}}`, v1)
		assert.Equal(t, v1, got["apiVersion"])
		assert.Equal(t, "RecordingRule", got["kind"])
	})

	// v0alpha1 decodes a missing type as SimplifiedRouting, and an object decoded
	// that way serializes with an empty type; v1beta1 requires it.
	for name, settings := range map[string]string{
		"missing type": `{"receiver":"r"}`,
		"empty type":   `{"type":"","receiver":"r"}`,
	} {
		t.Run("defaults "+name+" to SimplifiedRouting for v1beta1", func(t *testing.T) {
			got := convertRaw(t, `{"apiVersion":"`+v0+`","kind":"AlertRule","spec":{"notificationSettings":`+settings+`}}`, v1)
			assert.Equal(t, "SimplifiedRouting", notificationSettings(t, got)["type"])
			assert.Equal(t, "r", notificationSettings(t, got)["receiver"])
		})
	}

	t.Run("keeps an explicit type", func(t *testing.T) {
		got := convertRaw(t, `{"apiVersion":"`+v0+`","kind":"AlertRule","spec":{"notificationSettings":{"type":"NamedRoutingTree","routingTree":"t"}}}`, v1)
		assert.Equal(t, "NamedRoutingTree", notificationSettings(t, got)["type"])
	})

	t.Run("leaves v0alpha1 output alone", func(t *testing.T) {
		got := convertRaw(t, `{"apiVersion":"`+v1+`","kind":"AlertRule","spec":{"notificationSettings":{"type":"","receiver":"r"}}}`, v0)
		assert.Equal(t, v0, got["apiVersion"])
		assert.Equal(t, "", notificationSettings(t, got)["type"])
	})

	t.Run("does not add notification settings", func(t *testing.T) {
		got := convertRaw(t, `{"apiVersion":"`+v0+`","kind":"AlertRule","spec":{"title":"x"}}`, v1)
		assert.NotContains(t, got["spec"], "notificationSettings")
	})

	t.Run("renames RuleSequence spec.alertingRules to spec.alertRules for v1beta1", func(t *testing.T) {
		got := convertRaw(t, `{"apiVersion":"`+v0+`","kind":"RuleSequence","spec":{"recordingRules":[{"name":"r"}],"alertingRules":[{"name":"a"}]}}`, v1)
		assert.Equal(t, map[string]any{
			"recordingRules": []any{map[string]any{"name": "r"}},
			"alertRules":     []any{map[string]any{"name": "a"}},
		}, got["spec"])
	})

	t.Run("renames RuleSequence spec.alertRules to spec.alertingRules for v0alpha1", func(t *testing.T) {
		got := convertRaw(t, `{"apiVersion":"`+v1+`","kind":"RuleSequence","spec":{"recordingRules":[{"name":"r"}],"alertRules":[{"name":"a"}]}}`, v0)
		assert.Equal(t, map[string]any{
			"recordingRules": []any{map[string]any{"name": "r"}},
			"alertingRules":  []any{map[string]any{"name": "a"}},
		}, got["spec"])
	})

	t.Run("takes the kind from the RawKind", func(t *testing.T) {
		out, err := ruleConverter{}.Convert(k8s.RawKind{Kind: "RuleSequence", Raw: []byte(`{"spec":{"alertingRules":[{"name":"a"}]}}`)}, v1)
		require.NoError(t, err)
		assert.JSONEq(t, `{"apiVersion":"`+v1+`","kind":"RuleSequence","spec":{"alertRules":[{"name":"a"}]}}`, string(out))
	})

	t.Run("does not rename fields of other kinds", func(t *testing.T) {
		got := convertRaw(t, `{"apiVersion":"`+v0+`","kind":"AlertRule","spec":{"alertingRules":[]}}`, v1)
		assert.Contains(t, got["spec"], "alertingRules")
	})

	t.Run("keeps large numbers exact", func(t *testing.T) {
		out, err := ruleConverter{}.Convert(k8s.RawKind{Raw: []byte(`{"apiVersion":"` + v0 + `","spec":{"panelRef":{"panelID":9007199254740993}}}`)}, v1)
		require.NoError(t, err)
		assert.Contains(t, string(out), `"panelID":9007199254740993`)
	})

	t.Run("rejects invalid JSON", func(t *testing.T) {
		_, err := ruleConverter{}.Convert(k8s.RawKind{Raw: []byte(`{`)}, v1)
		require.Error(t, err)
	})
}
