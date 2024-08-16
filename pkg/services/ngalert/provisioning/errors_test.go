package provisioning

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

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
