package models_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/models/modelstest"

	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/assert"

	alertingmodels "github.com/grafana/alerting/models"
)

func TestSilenceGetRuleUID(t *testing.T) {
	testCases := []struct {
		name            string
		silence         models.Silence
		expectedRuleUID *string
	}{
		{
			name:            "silence with no rule UID",
			silence:         modelstest.SilenceGen()(),
			expectedRuleUID: nil,
		},
		{
			name:            "silence with rule UID",
			silence:         modelstest.SilenceGen(modelstest.SilenceMuts.WithMatcher(alertingmodels.RuleUIDLabel, "someuid", labels.MatchEqual))(),
			expectedRuleUID: new("someuid"),
		},
		{
			name:            "silence with rule UID Matcher but MatchNotEqual",
			silence:         modelstest.SilenceGen(modelstest.SilenceMuts.WithMatcher(alertingmodels.RuleUIDLabel, "someuid", labels.MatchNotEqual))(),
			expectedRuleUID: nil,
		},
		{
			name:            "silence with rule UID Matcher but MatchRegexp",
			silence:         modelstest.SilenceGen(modelstest.SilenceMuts.WithMatcher(alertingmodels.RuleUIDLabel, "someuid", labels.MatchRegexp))(),
			expectedRuleUID: nil,
		},
		{
			name:            "silence with rule UID Matcher but MatchNotRegexp",
			silence:         modelstest.SilenceGen(modelstest.SilenceMuts.WithMatcher(alertingmodels.RuleUIDLabel, "someuid", labels.MatchNotRegexp))(),
			expectedRuleUID: nil,
		},
	}
	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expectedRuleUID, tt.silence.GetRuleUID(), "unexpected rule UID")
		})
	}
}

func TestSilencePermissionSet(t *testing.T) {
	t.Run("Clone", func(t *testing.T) {
		perms := models.SilencePermissionSet{
			models.SilencePermissionRead:  true,
			models.SilencePermissionWrite: false,
		}
		clone := perms.Clone()
		assert.Equal(t, perms, clone)
		clone[models.SilencePermissionRead] = false
		assert.NotEqual(t, perms, clone)
	})

	t.Run("AllSet + SilencePermissions", func(t *testing.T) {
		readPerms := models.SilencePermissionSet{
			models.SilencePermissionRead: true,
		}
		assert.False(t, readPerms.AllSet())

		allPerms := models.SilencePermissionSet{}
		for _, perm := range models.SilencePermissions() {
			allPerms[perm] = true
		}
		assert.True(t, allPerms.AllSet())
	})

	t.Run("Has", func(t *testing.T) {
		testCases := []struct {
			name          string
			permissionSet models.SilencePermissionSet
			expectedHas   map[models.SilencePermission]bool
		}{
			{
				name: "all false",
				permissionSet: models.SilencePermissionSet{
					models.SilencePermissionRead:   false,
					models.SilencePermissionWrite:  false,
					models.SilencePermissionCreate: false,
				},
				expectedHas: map[models.SilencePermission]bool{
					models.SilencePermissionRead:   false,
					models.SilencePermissionWrite:  false,
					models.SilencePermissionCreate: false,
				},
			},
			{
				name: "all true",
				permissionSet: models.SilencePermissionSet{
					models.SilencePermissionRead:   true,
					models.SilencePermissionWrite:  true,
					models.SilencePermissionCreate: true,
				},
				expectedHas: map[models.SilencePermission]bool{
					models.SilencePermissionRead:   true,
					models.SilencePermissionWrite:  true,
					models.SilencePermissionCreate: true,
				},
			},
			{
				name: "mixed",
				permissionSet: models.SilencePermissionSet{
					models.SilencePermissionRead:   true,
					models.SilencePermissionWrite:  false,
					models.SilencePermissionCreate: true,
				},
				expectedHas: map[models.SilencePermission]bool{
					models.SilencePermissionRead:   true,
					models.SilencePermissionWrite:  false,
					models.SilencePermissionCreate: true,
				},
			},
			{
				name: "not set = false",
				permissionSet: models.SilencePermissionSet{
					models.SilencePermissionRead: true,
				},
				expectedHas: map[models.SilencePermission]bool{
					models.SilencePermissionRead:   true,
					models.SilencePermissionWrite:  false,
					models.SilencePermissionCreate: false,
				},
			},
		}
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				for perm, expected := range tc.expectedHas {
					assert.Equal(t, expected, tc.permissionSet.Has(perm))
				}
			})
		}
	})
}
