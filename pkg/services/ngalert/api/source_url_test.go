package api

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestToGettableExtendedRuleNodeSourceURL(t *testing.T) {
	rule := models.AlertRule{UID: "rule-1", Title: "rule"}
	const sourceURL = "https://example.com/alerts/rule.yaml"

	withURL := toGettableExtendedRuleNode(rule, nil, map[string]string{rule.UID: sourceURL}, nil)
	require.Equal(t, sourceURL, withURL.GrafanaManagedAlert.SourceURL)
	encoded, err := json.Marshal(withURL)
	require.NoError(t, err)
	require.Contains(t, string(encoded), `"sourceUrl":"`+sourceURL+`"`)

	// Versions and deleted rules pass an empty map, so a historical URL is omitted.
	withoutURL := toGettableExtendedRuleNode(rule, map[string]models.Provenance{}, nil, nil)
	require.Empty(t, withoutURL.GrafanaManagedAlert.SourceURL)
	encoded, err = json.Marshal(withoutURL)
	require.NoError(t, err)
	require.NotContains(t, string(encoded), "sourceUrl")
}
