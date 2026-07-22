package provisioning

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func ruleKeys(uids ...string) []models.AlertRuleKey {
	keys := make([]models.AlertRuleKey, 0, len(uids))
	for _, uid := range uids {
		keys = append(keys, models.AlertRuleKey{OrgID: 1, UID: uid})
	}
	return keys
}

func TestMakeErrTimeIntervalInUse(t *testing.T) {
	tests := []struct {
		name                  string
		usedByRoutes          bool
		rules                 []models.AlertRuleKey
		expectedLogMessage    string
		expectedPublicMessage string
		expectedPayloadRules  any
	}{
		{
			name:                  "routes only",
			usedByRoutes:          true,
			rules:                 nil,
			expectedLogMessage:    "[alerting.notifications.time-intervals.used] Time interval is used by notification policies",
			expectedPublicMessage: "Time interval is used by notification policies",
			expectedPayloadRules:  nil,
		},
		{
			name:                  "single rule",
			usedByRoutes:          false,
			rules:                 ruleKeys("uid-1"),
			expectedLogMessage:    "[alerting.notifications.time-intervals.used] Time interval is used by alert rules uid-1",
			expectedPublicMessage: "Time interval is used by alert rules",
			expectedPayloadRules:  "uid-1",
		},
		{
			name:                  "rules and routes",
			usedByRoutes:          true,
			rules:                 ruleKeys("uid-1"),
			expectedLogMessage:    "[alerting.notifications.time-intervals.used] Time interval is used by alert rules uid-1 and notification policies",
			expectedPublicMessage: "Time interval is used by alert rules and notification policies",
			expectedPayloadRules:  "uid-1",
		},
		{
			name:                  "exactly five rules lists all of them",
			usedByRoutes:          false,
			rules:                 ruleKeys("uid-1", "uid-2", "uid-3", "uid-4", "uid-5"),
			expectedLogMessage:    "[alerting.notifications.time-intervals.used] Time interval is used by alert rules uid-1, uid-2, uid-3, uid-4, uid-5",
			expectedPublicMessage: "Time interval is used by alert rules",
			expectedPayloadRules:  "uid-1, uid-2, uid-3, uid-4, uid-5",
		},
		{
			name:                  "more than five rules keeps full log but truncates payload",
			usedByRoutes:          false,
			rules:                 ruleKeys("uid-1", "uid-2", "uid-3", "uid-4", "uid-5", "uid-6", "uid-7"),
			expectedLogMessage:    "[alerting.notifications.time-intervals.used] Time interval is used by alert rules uid-1, uid-2, uid-3, uid-4, uid-5, uid-6, uid-7",
			expectedPublicMessage: "Time interval is used by alert rules",
			expectedPayloadRules:  "uid-1, uid-2, uid-3, uid-4, uid-5 and 2 others",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := MakeErrTimeIntervalInUse(tt.usedByRoutes, tt.rules)
			assert.Equal(t, tt.expectedLogMessage, err.Error())
			var e errutil.Error
			require.True(t, errors.As(err, &e))
			assert.Equal(t, tt.expectedPublicMessage, e.PublicMessage)
			assert.Equal(t, tt.expectedPayloadRules, e.PublicPayload["UsedByRules"])
		})
	}
}

func TestMakeErrTimeIntervalDependentResourcesProvenance(t *testing.T) {
	tests := []struct {
		name                   string
		usedByRoutes           bool
		rules                  []models.AlertRuleKey
		expectedPrivateMessage string
		expectedPublicMessage  string
	}{
		{
			name:                   "both specified",
			usedByRoutes:           true,
			rules:                  []models.AlertRuleKey{models.GenerateRuleKey(1)},
			expectedPrivateMessage: "[alerting.notifications.time-intervals.usedProvisioned] Time interval cannot be renamed because it is used by provisioned alert rules and notification policies",
			expectedPublicMessage:  "Time interval cannot be renamed because it is used by provisioned alert rules and notification policies. You must update those resources first using the original provision method.",
		},
		{
			name:                   "rules specified",
			usedByRoutes:           false,
			rules:                  []models.AlertRuleKey{models.GenerateRuleKey(1)},
			expectedPrivateMessage: "[alerting.notifications.time-intervals.usedProvisioned] Time interval cannot be renamed because it is used by provisioned alert rules",
			expectedPublicMessage:  "Time interval cannot be renamed because it is used by provisioned alert rules. You must update those resources first using the original provision method.",
		},
		{
			name:                   "routes specified",
			usedByRoutes:           true,
			rules:                  nil,
			expectedPrivateMessage: "[alerting.notifications.time-intervals.usedProvisioned] Time interval cannot be renamed because it is used by provisioned notification policies",
			expectedPublicMessage:  "Time interval cannot be renamed because it is used by provisioned notification policies. You must update those resources first using the original provision method.",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := MakeErrTimeIntervalDependentResourcesProvenance(tt.usedByRoutes, tt.rules)
			assert.Equal(t, tt.expectedPrivateMessage, err.Error())
			var e errutil.Error
			require.True(t, errors.As(err, &e))
			assert.Equal(t, tt.expectedPublicMessage, e.PublicMessage)
		})
	}
}
