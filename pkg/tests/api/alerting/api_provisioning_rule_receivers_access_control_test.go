package alerting

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioningRuleNotificationSettingsAccessControl(t *testing.T) {
	testinfra.RunWithFeatureToggle(t, featuremgmt.FlagAuthzUseLegacyCheck, testIntegrationProvisioningRuleNotificationSettingsAccessControl)
}

// testIntegrationProvisioningRuleNotificationSettingsAccessControl checks that rules can only be created and updated
// with a receiver in their notification settings that the user can read. Rules refer to receivers by name whereas
// the permissions are keyed by the UID of the receiver, which is not derived from its name.
func testIntegrationProvisioningRuleNotificationSettingsAccessControl(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	const (
		allowedName   = "allowed-receiver"
		forbiddenName = "forbidden-receiver"
		missingName   = "missing-receiver"
	)

	e := setupProvisioningAccessControlTest(t)
	orgID := e.env.Cfg.DefaultOrgID()
	e.adminClient.CreateFolder(t, ruleGroupTargetFolderUID, "Rules target")

	settings, err := simplejson.NewJson([]byte(`{"url":"http://localhost/webhook"}`))
	require.NoError(t, err)
	for _, name := range []string{allowedName, forbiddenName} {
		e.adminClient.EnsureReceiver(t, definitions.EmbeddedContactPoint{Name: name, Type: "webhook", Settings: settings})
	}
	uids := e.adminClient.receiverUIDs(t)
	require.Contains(t, uids, allowedName)
	require.Contains(t, uids, forbiddenName)
	require.NotEqual(t, allowedName, uids[allowedName], "the UID of a receiver should not be its name")

	// Permissions without a resource are set together as setting them again replaces the previous ones.
	grants := func(unscopedActions []string, receivers ...resourcepermissions.SetResourcePermissionCommand) []resourcepermissions.SetResourcePermissionCommand {
		return append([]resourcepermissions.SetResourcePermissionCommand{
			{
				Actions: []string{
					accesscontrol.ActionAlertingRuleRead,
					accesscontrol.ActionAlertingRuleCreate,
					accesscontrol.ActionAlertingRuleUpdate,
					folder.ActionFoldersRead,
				},
				Resource:          folder.ScopeFoldersRoot,
				ResourceAttribute: "uid",
				ResourceID:        ruleGroupTargetFolderUID,
			},
			{Actions: append([]string{accesscontrol.ActionAlertingProvisioningSetStatus}, unscopedActions...)},
		}, receivers...)
	}
	readReceiver := func(uid string) resourcepermissions.SetResourcePermissionCommand {
		return resourcepermissions.SetResourcePermissionCommand{
			Actions:           []string{accesscontrol.ActionAlertingReceiversRead},
			Resource:          ngmodels.ScopeReceiversRoot,
			ResourceAttribute: "uid",
			ResourceID:        uid,
		}
	}
	allowedOnly := e.createUserAndClient(t, provisioningTestCase{permissions: grants(nil, readReceiver(uids[allowedName]))})
	forbiddenOnly := e.createUserAndClient(t, provisioningTestCase{permissions: grants(nil, readReceiver(uids[forbiddenName]))})
	// Can read all receivers, including those that do not exist yet.
	allReceivers := e.createUserAndClient(t, provisioningTestCase{permissions: grants([]string{accesscontrol.ActionAlertingNotificationsRead})})
	// Can read every receiver that exists, but this does not extend to those that do not.
	everyUID := e.createUserAndClient(t, provisioningTestCase{permissions: grants(nil, readReceiver("*"))})
	noReceivers := e.createUserAndClient(t, provisioningTestCase{permissions: grants(nil)})

	ruleCount := 0
	newRule := func(receiver string) definitions.ProvisionedAlertRule {
		ruleCount++
		group := fmt.Sprintf("group-%d", ruleCount)
		rule := provisioningPermissionRule(fmt.Sprintf("rule-%d", ruleCount), group, orgID)
		rule.NotificationSettings = &definitions.AlertRuleNotificationSettings{Receiver: receiver}
		return rule
	}
	group := func(rules ...definitions.ProvisionedAlertRule) definitions.AlertRuleGroup {
		return definitions.AlertRuleGroup{
			Title:     rules[0].RuleGroup,
			FolderUID: ruleGroupTargetFolderUID,
			Interval:  60,
			Rules:     rules,
		}
	}

	// Creating, either as a rule of its own or as a group.
	createCases := []struct {
		name     string
		client   apiClient
		receiver string
		want     int
	}{
		{"scoped read of the receiver", allowedOnly, allowedName, http.StatusOK},
		{"scoped read of another receiver", allowedOnly, forbiddenName, http.StatusForbidden},
		{"no access to receivers", noReceivers, allowedName, http.StatusForbidden},
		{"read of all receivers", allReceivers, forbiddenName, http.StatusOK},
		{"scoped read of every receiver", everyUID, forbiddenName, http.StatusOK},
		{"scoped read of every receiver, receiver does not exist", everyUID, missingName, http.StatusForbidden},
		{"scoped read, receiver does not exist", allowedOnly, missingName, http.StatusForbidden},
		// The name of a receiver that does not exist is not taken for the UID of the receiver the user can read.
		{"scoped read, receiver is named like the UID of the one that can be read", forbiddenOnly, uids[forbiddenName], http.StatusForbidden},
		{"read of all receivers, receiver does not exist", allReceivers, missingName, http.StatusBadRequest},
	}
	for _, tc := range createCases {
		t.Run("create rule/"+tc.name, func(t *testing.T) {
			rule := newRule(tc.receiver)
			status, body := tc.client.createRuleProvisioning(t, rule)
			if tc.want == http.StatusOK {
				require.Equal(t, http.StatusCreated, status, body)
			} else {
				require.Equal(t, tc.want, status, body)
			}
		})
		t.Run("create group/"+tc.name, func(t *testing.T) {
			g := group(newRule(tc.receiver))
			_, status, body := tc.client.CreateOrUpdateRuleGroupProvisioning(t, g)
			require.Equal(t, tc.want, status, body)

			_, status, _ = e.adminClient.GetRuleGroupProvisioning(t, g.FolderUID, g.Title)
			if tc.want == http.StatusOK {
				require.Equal(t, http.StatusOK, status)
			} else {
				require.Equal(t, http.StatusNotFound, status, "denied or invalid requests must not create the group")
			}
		})
	}

	// Updating, which only needs access to the receiver when it is changed.
	t.Run("update rule", func(t *testing.T) {
		rule := newRule(allowedName)
		_, status, body := e.adminClient.CreateOrUpdateRuleGroupProvisioning(t, group(rule))
		require.Equal(t, http.StatusOK, status, body)

		changeReceiver := func(receiver string) definitions.ProvisionedAlertRule {
			updated := rule
			updated.NotificationSettings = &definitions.AlertRuleNotificationSettings{Receiver: receiver}
			return updated
		}
		rename := rule
		rename.Title = "renamed"

		for _, tc := range []struct {
			name   string
			client apiClient
			rule   definitions.ProvisionedAlertRule
			want   int
		}{
			{"changing something else without access to the receiver", noReceivers, rename, http.StatusOK},
			{"changing the receiver to one the user cannot read", allowedOnly, changeReceiver(forbiddenName), http.StatusForbidden},
			{"changing the receiver without access to receivers", noReceivers, changeReceiver(forbiddenName), http.StatusForbidden},
			{"changing the receiver to one that does not exist", allowedOnly, changeReceiver(missingName), http.StatusForbidden},
			{"changing the receiver to one the user can read", allReceivers, changeReceiver(forbiddenName), http.StatusOK},
		} {
			t.Run(tc.name, func(t *testing.T) {
				status, body := tc.client.updateRuleProvisioning(t, tc.rule)
				require.Equal(t, tc.want, status, body)
			})
		}
	})

	t.Run("update group", func(t *testing.T) {
		rule := newRule(allowedName)
		_, status, body := e.adminClient.CreateOrUpdateRuleGroupProvisioning(t, group(rule))
		require.Equal(t, http.StatusOK, status, body)
		before, status, body := e.adminClient.GetRuleGroupProvisioning(t, ruleGroupTargetFolderUID, rule.RuleGroup)
		require.Equal(t, http.StatusOK, status, body)

		withRule := func(modify func(*definitions.ProvisionedAlertRule)) definitions.AlertRuleGroup {
			g := before
			g.Rules = []definitions.ProvisionedAlertRule{before.Rules[0]}
			modify(&g.Rules[0])
			return g
		}

		t.Run("changing something else without access to the receiver", func(t *testing.T) {
			_, status, body := noReceivers.CreateOrUpdateRuleGroupProvisioning(t, withRule(func(r *definitions.ProvisionedAlertRule) { r.Title = "renamed" }))
			require.Equal(t, http.StatusOK, status, body)
		})

		for _, tc := range []struct {
			name     string
			client   apiClient
			receiver string
		}{
			{"changing the receiver to one the user cannot read", allowedOnly, forbiddenName},
			{"changing the receiver without access to receivers", noReceivers, forbiddenName},
		} {
			t.Run(tc.name, func(t *testing.T) {
				current, status, body := e.adminClient.GetRuleGroupProvisioning(t, ruleGroupTargetFolderUID, rule.RuleGroup)
				require.Equal(t, http.StatusOK, status, body)

				g := current
				g.Rules = []definitions.ProvisionedAlertRule{current.Rules[0]}
				g.Rules[0].NotificationSettings = &definitions.AlertRuleNotificationSettings{Receiver: tc.receiver}
				_, status, body = tc.client.CreateOrUpdateRuleGroupProvisioning(t, g)
				require.Equal(t, http.StatusForbidden, status, body)

				after, status, body := e.adminClient.GetRuleGroupProvisioning(t, ruleGroupTargetFolderUID, rule.RuleGroup)
				require.Equal(t, http.StatusOK, status, body)
				require.Equal(t, current, after, "denied requests must not change the group")
			})
		}

		t.Run("changing the receiver to one the user can read", func(t *testing.T) {
			_, status, body := allReceivers.CreateOrUpdateRuleGroupProvisioning(t, withRule(func(r *definitions.ProvisionedAlertRule) {
				r.NotificationSettings = &definitions.AlertRuleNotificationSettings{Receiver: forbiddenName}
			}))
			require.Equal(t, http.StatusOK, status, body)
		})
	})
}

// receiverUIDs returns the UIDs of the receivers by their title.
func (a apiClient) receiverUIDs(t *testing.T) map[string]string {
	t.Helper()

	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/apis/notifications.alerting.grafana.app/v1beta1/namespaces/default/receivers", a.url), nil)
	require.NoError(t, err)
	body, status, err := sendRequestRaw(t, req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, status, string(body))

	var list struct {
		Items []struct {
			Metadata struct {
				Name string `json:"name"`
			} `json:"metadata"`
			Spec struct {
				Title string `json:"title"`
			} `json:"spec"`
		} `json:"items"`
	}
	require.NoError(t, json.Unmarshal(body, &list))
	uids := make(map[string]string, len(list.Items))
	for _, item := range list.Items {
		uids[item.Spec.Title] = item.Metadata.Name
	}
	return uids
}

func (a apiClient) createRuleProvisioning(t *testing.T, rule definitions.ProvisionedAlertRule) (int, string) {
	t.Helper()

	b, err := json.Marshal(rule)
	require.NoError(t, err)
	req, err := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/api/v1/provisioning/alert-rules", a.url), bytes.NewReader(b))
	require.NoError(t, err)
	req.Header.Add("Content-Type", "application/json")
	body, status, err := sendRequestRaw(t, req)
	require.NoError(t, err)
	return status, string(body)
}

func (a apiClient) updateRuleProvisioning(t *testing.T, rule definitions.ProvisionedAlertRule) (int, string) {
	t.Helper()

	b, err := json.Marshal(rule)
	require.NoError(t, err)
	req, err := http.NewRequest(http.MethodPut, fmt.Sprintf("%s/api/v1/provisioning/alert-rules/%s", a.url, rule.UID), bytes.NewReader(b))
	require.NoError(t, err)
	req.Header.Add("Content-Type", "application/json")
	body, status, err := sendRequestRaw(t, req)
	require.NoError(t, err)
	return status, string(body)
}
