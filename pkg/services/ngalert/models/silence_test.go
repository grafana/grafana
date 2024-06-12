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

func TestSilencePermissionSet(t *testing.T) {
	t.Run("Clone", func(t *testing.T) {
		perms := SilencePermissionSet{
			SilencePermissionRead:  true,
			SilencePermissionWrite: false,
		}
		clone := perms.Clone()
		assert.Equal(t, perms, clone)
		clone[SilencePermissionRead] = false
		assert.NotEqual(t, perms, clone)
	})

	t.Run("AllSet + SilencePermissions", func(t *testing.T) {
		readPerms := SilencePermissionSet{
			SilencePermissionRead: true,
		}
		assert.False(t, readPerms.AllSet())

		allPerms := SilencePermissionSet{}
		for _, perm := range SilencePermissions() {
			allPerms[perm] = true
		}
		assert.True(t, allPerms.AllSet())
	})

	t.Run("Has", func(t *testing.T) {
		testCases := []struct {
			name          string
			permissionSet SilencePermissionSet
			expectedHas   map[SilencePermission]bool
		}{
			{
				name: "all false",
				permissionSet: SilencePermissionSet{
					SilencePermissionRead:   false,
					SilencePermissionWrite:  false,
					SilencePermissionCreate: false,
				},
				expectedHas: map[SilencePermission]bool{
					SilencePermissionRead:   false,
					SilencePermissionWrite:  false,
					SilencePermissionCreate: false,
				},
			},
			{
				name: "all true",
				permissionSet: SilencePermissionSet{
					SilencePermissionRead:   true,
					SilencePermissionWrite:  true,
					SilencePermissionCreate: true,
				},
				expectedHas: map[SilencePermission]bool{
					SilencePermissionRead:   true,
					SilencePermissionWrite:  true,
					SilencePermissionCreate: true,
				},
			},
			{
				name: "mixed",
				permissionSet: SilencePermissionSet{
					SilencePermissionRead:   true,
					SilencePermissionWrite:  false,
					SilencePermissionCreate: true,
				},
				expectedHas: map[SilencePermission]bool{
					SilencePermissionRead:   true,
					SilencePermissionWrite:  false,
					SilencePermissionCreate: true,
				},
			},
			{
				name: "not set = false",
				permissionSet: SilencePermissionSet{
					SilencePermissionRead: true,
				},
				expectedHas: map[SilencePermission]bool{
					SilencePermissionRead:   true,
					SilencePermissionWrite:  false,
					SilencePermissionCreate: false,
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
