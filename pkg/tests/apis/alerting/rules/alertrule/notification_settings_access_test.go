package alertrule

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/folder"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/rules/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationNotificationSettingsReceiverAccessControl checks that the receivers that a rule's notification
// settings route to can only be used by those who can read them. It uses the real authorization of the rules API,
// which refers to receivers by name, and of receivers, which is keyed by their UID.
func TestIntegrationNotificationSettingsReceiverAccessControl(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := common.GetTestHelper(t)
	const folderUID = "test-folder"
	common.CreateTestFolder(t, helper, folderUID)

	// Receivers have UIDs that are not their titles, which is what rules refer to them by.
	const (
		allowedUID    = "allowed-receiver-uid"
		allowedTitle  = "allowed-receiver"
		forbiddenUID  = "forbidden-receiver-uid"
		forbiddenName = "forbidden-receiver"
	)
	receivers, err := v1beta1.NewReceiverClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
	require.NoError(t, err)
	for uid, title := range map[string]string{allowedUID: allowedTitle, forbiddenUID: forbiddenName} {
		_, err := receivers.Create(ctx, &v1beta1.Receiver{
			ObjectMeta: v1.ObjectMeta{Name: uid, Namespace: "default"},
			Spec:       v1beta1.ReceiverSpec{Title: title, Integrations: []v1beta1.ReceiverIntegration{}},
		}, resource.CreateOptions{})
		require.NoError(t, err)
	}

	folderGrant := resourcepermissions.SetResourcePermissionCommand{
		Actions: []string{
			accesscontrol.ActionAlertingRuleRead,
			accesscontrol.ActionAlertingRuleCreate,
			accesscontrol.ActionAlertingRuleUpdate,
			folder.ActionFoldersRead,
		},
		Resource:          folder.ScopeFoldersRoot,
		ResourceAttribute: "uid",
		ResourceID:        folderUID,
	}
	receiverGrant := func(uid string) resourcepermissions.SetResourcePermissionCommand {
		return resourcepermissions.SetResourcePermissionCommand{
			Actions:           []string{accesscontrol.ActionAlertingReceiversRead},
			Resource:          ngmodels.ScopeReceiversRoot,
			ResourceAttribute: "uid",
			ResourceID:        uid,
		}
	}
	newUser := func(name string, grants ...resourcepermissions.SetResourcePermissionCommand) alertRuleClient {
		user := helper.CreateUser(name, apis.Org1, org.RoleNone, append([]resourcepermissions.SetResourcePermissionCommand{folderGrant}, grants...))
		return common.NewAlertRuleClient(t, user)
	}
	allowedOnly := newUser("allowed-only", receiverGrant(allowedUID))
	allReceivers := newUser("all-receivers", receiverGrant("*"))
	noReceivers := newUser("no-receivers")
	adminClient := common.NewAlertRuleClient(t, helper.Org1.Admin)

	newRule := func(title, receiver string) *v0alpha1.AlertRule {
		return &v0alpha1.AlertRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace:   "default",
				Annotations: map[string]string{"grafana.app/folder": folderUID},
			},
			Spec: v0alpha1.AlertRuleSpec{
				Title: title,
				Expressions: v0alpha1.AlertRuleExpressionMap{
					"A": {
						DatasourceUID: new(v0alpha1.AlertRuleDatasourceUID(expr.DatasourceUID)),
						Model:         map[string]any{"type": "math", "expression": "1"},
						Source:        new(true),
					},
				},
				Trigger:      v0alpha1.AlertRuleIntervalTrigger{Interval: v0alpha1.AlertRulePromDuration("1m")},
				NoDataState:  v0alpha1.AlertRuleNoDataStateNoData,
				ExecErrState: v0alpha1.AlertRuleExecErrStateError,
				NotificationSettings: &v0alpha1.AlertRuleNotificationSettings{
					SimplifiedRouting: &v0alpha1.AlertRuleSimplifiedRouting{
						Type:     v0alpha1.AlertRuleNotificationSettingsTypeSimplifiedRouting,
						Receiver: receiver,
					},
				},
				Labels: map[string]v0alpha1.AlertRuleTemplateString{},
			},
		}
	}

	t.Run("create", func(t *testing.T) {
		// A receiver that does not exist is rejected by the admission of the rules API for everyone, before the service
		// authorizes the receivers, so it is covered with the provisioning API where only the service is involved.
		cases := []struct {
			name     string
			client   alertRuleClient
			receiver string
			check    func(t *testing.T, err error)
		}{
			{"scoped read of the receiver", allowedOnly, allowedTitle, requireNoError},
			{"scoped read of another receiver", allowedOnly, forbiddenName, requireForbidden},
			{"no access to receivers", noReceivers, allowedTitle, requireForbidden},
			{"read of all receivers", allReceivers, forbiddenName, requireNoError},
		}
		for i, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				created, err := tc.client.Create(ctx, newRule(fmt.Sprintf("create-%d", i), tc.receiver), v1.CreateOptions{})
				tc.check(t, err)
				if err == nil {
					t.Cleanup(func() { _ = adminClient.Delete(ctx, created.Name, v1.DeleteOptions{}) })
				}
			})
		}
	})

	t.Run("update", func(t *testing.T) {
		existing, err := adminClient.Create(ctx, newRule("update", allowedTitle), v1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = adminClient.Delete(ctx, existing.Name, v1.DeleteOptions{}) })

		withReceiver := func(receiver string) *v0alpha1.AlertRule {
			updated := existing.Copy().(*v0alpha1.AlertRule)
			updated.Spec.NotificationSettings.SimplifiedRouting.Receiver = receiver
			return updated
		}

		t.Run("changing the receiver to one the user cannot read", func(t *testing.T) {
			_, err := allowedOnly.Update(ctx, withReceiver(forbiddenName), v1.UpdateOptions{})
			requireForbidden(t, err)
		})
		t.Run("changing the receiver without access to receivers", func(t *testing.T) {
			_, err := noReceivers.Update(ctx, withReceiver(forbiddenName), v1.UpdateOptions{})
			requireForbidden(t, err)
		})
		t.Run("changing something else does not need access to the receiver", func(t *testing.T) {
			updated := existing.Copy().(*v0alpha1.AlertRule)
			updated.Spec.Title = "update-renamed"
			updated.Spec.Trigger.Interval = v0alpha1.AlertRulePromDuration("2m")
			_, err := noReceivers.Update(ctx, updated, v1.UpdateOptions{})
			requireNoError(t, err)
		})
		t.Run("changing the receiver to one the user can read", func(t *testing.T) {
			current, err := adminClient.Get(ctx, existing.Name, v1.GetOptions{})
			require.NoError(t, err)
			updated := current.Copy().(*v0alpha1.AlertRule)
			updated.Spec.NotificationSettings.SimplifiedRouting.Receiver = forbiddenName
			_, err = allReceivers.Update(ctx, updated, v1.UpdateOptions{})
			requireNoError(t, err)
		})
	})
}

type alertRuleClient = *apis.TypedClient[v0alpha1.AlertRule, v0alpha1.AlertRuleList]

func requireNoError(t *testing.T, err error) {
	t.Helper()
	require.NoError(t, err)
}

func requireForbidden(t *testing.T, err error) {
	t.Helper()
	require.Error(t, err)
	require.Truef(t, apierrors.IsForbidden(err), "expected a forbidden error but got %v", err)
	require.ErrorContains(t, err, "not authorized to read")
}
