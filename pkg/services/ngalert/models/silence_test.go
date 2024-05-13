package models

import (
	"testing"

	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/assert"

	"github.com/grafana/alerting/models"
	"github.com/grafana/grafana/pkg/util"
)

func TestSilenceGetRuleUID(t *testing.T) {
	testCases := []struct {
		name            string
		silence         Silence
		expectedRuleUID *string
	}{
		{
			name:            "silence with no rule UID",
			silence:         SilenceGen()(),
			expectedRuleUID: nil,
		},
		{
			name:            "silence with rule UID",
			silence:         SilenceGen(SilenceMuts.WithMatcher(models.RuleUIDLabel, "someuid", labels.MatchEqual))(),
			expectedRuleUID: util.Pointer("someuid"),
		},
		{
			name:            "silence with rule UID Matcher but MatchNotEqual",
			silence:         SilenceGen(SilenceMuts.WithMatcher(models.RuleUIDLabel, "someuid", labels.MatchNotEqual))(),
			expectedRuleUID: nil,
		},
		{
			name:            "silence with rule UID Matcher but MatchRegexp",
			silence:         SilenceGen(SilenceMuts.WithMatcher(models.RuleUIDLabel, "someuid", labels.MatchRegexp))(),
			expectedRuleUID: nil,
		},
		{
			name:            "silence with rule UID Matcher but MatchNotRegexp",
			silence:         SilenceGen(SilenceMuts.WithMatcher(models.RuleUIDLabel, "someuid", labels.MatchNotRegexp))(),
			expectedRuleUID: nil,
		},
	}
	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expectedRuleUID, tt.silence.GetRuleUID(), "unexpected rule UID")
		})
	}
}
