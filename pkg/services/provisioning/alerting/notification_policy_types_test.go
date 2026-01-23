package alerting

import (
	"fmt"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"

	policy_exports "github.com/grafana/grafana/pkg/services/ngalert/api/test-data/policy-exports"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
)

func TestNotificationPolicy(t *testing.T) {
	const (
		envKey   = "NOTIFIER_EMAIL_REMINDER_FREQUENCY"
		envValue = "4h"
	)
	t.Setenv(envKey, envValue)

	data := `orgId: 123
receiver: test
continue: true
repeat_interval: ${NOTIFIER_EMAIL_REMINDER_FREQUENCY}
`
	var model NotificiationPolicyV1

	err := yaml.Unmarshal([]byte(data), &model)
	require.NoError(t, err)
	np, err := model.mapToModel()
	require.NoError(t, err)
	require.Equal(t, int64(123), np.OrgID)
	require.Equal(t, "test", np.Policy.Receiver)
	require.Equal(t, legacy_storage.UserDefinedRoutingTreeName, np.Name)
	require.True(t, np.Policy.Continue)
	require.Equal(t, envValue, np.Policy.RepeatInterval.String())
}

func TestNotificationPolicyWithName(t *testing.T) {
	const (
		envKey   = "NOTIFIER_EMAIL_REMINDER_FREQUENCY"
		envValue = "4h"
	)
	t.Setenv(envKey, envValue)

	data := `orgId: 123
receiver: test
continue: true
name: "test-policy"
repeat_interval: ${NOTIFIER_EMAIL_REMINDER_FREQUENCY}
`
	var model NotificiationPolicyV1

	err := yaml.Unmarshal([]byte(data), &model)
	require.NoError(t, err)
	np, err := model.mapToModel()
	require.NoError(t, err)
	require.Equal(t, int64(123), np.OrgID)
	require.Equal(t, "test", np.Policy.Receiver)
	require.Equal(t, "test-policy", np.Name)
	require.True(t, np.Policy.Continue)
	require.Equal(t, envValue, np.Policy.RepeatInterval.String())
}

func TestNotificationPolicyExportSnapshots(t *testing.T) {
	policies := []string{legacy_storage.UserDefinedRoutingTreeName}
	config := policy_exports.Config()
	for policy := range config.ManagedRoutes {
		policies = append(policies, policy)
	}

	for _, policyName := range policies {
		t.Run(fmt.Sprintf("policy=%s", policyName), func(t *testing.T) {
			for _, exportType := range []string{"json", "yaml"} {
				t.Run(fmt.Sprintf("exportType=%s", exportType), func(t *testing.T) {
					data, err := policy_exports.ReadExportResponse(policyName, exportType)
					assert.NoError(t, err)

					var alertFileV1 *AlertingFileV1
					err = yaml.Unmarshal(data, &alertFileV1)
					assert.NoError(t, err)

					alertFile, err := alertFileV1.MapToModel()
					assert.NoError(t, err)

					assert.Len(t, alertFile.Policies, 1)
					policy := alertFile.Policies[0]

					assert.Equal(t, policyName, policy.Name)
					assert.Equal(t, policy.OrgID, int64(1))

					expected := config.ManagedRoutes[policyName]
					if policyName == legacy_storage.UserDefinedRoutingTreeName {
						expected = config.AlertmanagerConfig.Route
					}

					cOpt := cmpopts.IgnoreUnexported(apimodels.Route{}, labels.Matcher{})
					if !cmp.Equal(policy.Policy, *expected, cOpt) {
						assert.Fail(t, fmt.Sprintf("Not equal: \nexpected: %#v\nactual  : %#v\n\nDiff:\n%s",
							*expected, policy.Policy, cmp.Diff(policy.Policy, *expected, cOpt)))
					}
				})
			}
		})
	}
}
