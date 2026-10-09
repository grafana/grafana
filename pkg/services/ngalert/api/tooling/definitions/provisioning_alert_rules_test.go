package definitions

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/go-openapi/strfmt"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestStrfmtDuration(t *testing.T) {
	const day = 24 * time.Hour
	testCases := []struct {
		in       time.Duration
		expected string
	}{
		{in: 0, expected: "0s"},
		{in: 5 * time.Minute, expected: "5m"},
		{in: 90 * time.Second, expected: "1m30s"},
		{in: 14 * day, expected: "2w"},
		{in: 90 * day, expected: "90d"},
		{in: 365*day + time.Hour, expected: "365d1h"},
		{in: 365 * day, expected: "365d"},
		{in: 730 * day, expected: "730d"},
		{in: 7 * 365 * day, expected: "2555d"},
	}
	for _, tc := range testCases {
		t.Run(tc.expected, func(t *testing.T) {
			s := StrfmtDuration(model.Duration(tc.in))
			require.Equal(t, tc.expected, s)

			parsed, err := strfmt.ParseDuration(s)
			require.NoError(t, err)
			require.Equal(t, tc.in, parsed)

			promParsed, err := model.ParseDuration(s)
			require.NoError(t, err)
			require.Equal(t, model.Duration(tc.in), promParsed)
		})
	}
}

func TestProvisionedAlertRuleMarshalJSON(t *testing.T) {
	rule := ProvisionedAlertRule{
		UID:           "rule-uid",
		Title:         "rule",
		For:           model.Duration(5 * time.Minute),
		KeepFiringFor: model.Duration(8760 * time.Hour),
		Labels:        map[string]string{"team": "a"},
	}

	t.Run("durations never use the year unit", func(t *testing.T) {
		b, err := json.Marshal(rule)
		require.NoError(t, err)

		var raw map[string]any
		require.NoError(t, json.Unmarshal(b, &raw))
		require.Equal(t, "5m", raw["for"])
		require.Equal(t, "365d", raw["keep_firing_for"])
	})

	t.Run("round-trips", func(t *testing.T) {
		b, err := json.Marshal(rule)
		require.NoError(t, err)

		var decoded ProvisionedAlertRule
		require.NoError(t, json.Unmarshal(b, &decoded))
		require.Equal(t, rule, decoded)
	})

	t.Run("applies to rules inside a group", func(t *testing.T) {
		b, err := json.Marshal(AlertRuleGroup{Title: "group", Rules: []ProvisionedAlertRule{rule}})
		require.NoError(t, err)

		var raw struct {
			Rules []map[string]any `json:"rules"`
		}
		require.NoError(t, json.Unmarshal(b, &raw))
		require.Equal(t, "365d", raw.Rules[0]["keep_firing_for"])
	})
}
