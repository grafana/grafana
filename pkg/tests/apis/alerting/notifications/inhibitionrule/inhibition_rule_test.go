package inhibitionrule

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func getTestHelper(t *testing.T) *apis.K8sTestHelper {
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{})
}

func TestIntegrationInhibitionRules(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := getTestHelper(t)
	client, err := v0alpha1.NewInhibitionRuleClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
	require.NoError(t, err)

	newRule := &v0alpha1.InhibitionRule{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
			Name:      "test-rule",
		},
		Spec: v0alpha1.InhibitionRuleSpec{
			SourceMatchers: []v0alpha1.InhibitionRuleMatcher{
				{
					Type:  v0alpha1.InhibitionRuleMatcherTypeEqual,
					Label: "alertname",
					Value: "SourceAlert",
				},
			},
			TargetMatchers: []v0alpha1.InhibitionRuleMatcher{
				{
					Type:  v0alpha1.InhibitionRuleMatcherTypeEqual,
					Label: "alertname",
					Value: "TargetAlert",
				},
			},
			Equal: []string{"instance"},
		},
	}

	t.Run("create should fail if object name is missing", func(t *testing.T) {
		rule := newRule.DeepCopy()
		rule.Name = ""
		_, err := client.Create(ctx, rule, resource.CreateOptions{})
		require.Truef(t, errors.IsBadRequest(err), "Expected BadRequest but got %s", err)
	})

	t.Run("create should fail if no source matchers", func(t *testing.T) {
		rule := newRule.DeepCopy()
		rule.Spec.SourceMatchers = nil
		_, err := client.Create(ctx, rule, resource.CreateOptions{})
		require.Truef(t, errors.IsBadRequest(err), "Expected BadRequest but got %s", err)
	})

	t.Run("create should fail if no target matchers", func(t *testing.T) {
		rule := newRule.DeepCopy()
		rule.Spec.TargetMatchers = nil
		_, err := client.Create(ctx, rule, resource.CreateOptions{})
		require.Truef(t, errors.IsBadRequest(err), "Expected BadRequest but got %s", err)
	})

	var existingRule *v0alpha1.InhibitionRule
	t.Run("create should succeed if inhibition rule doesn't exist", func(t *testing.T) {
		var err error
		existingRule, err = client.Create(ctx, newRule, resource.CreateOptions{})
		require.Nil(t, err)
		require.NotNil(t, existingRule)
		require.Equal(t, newRule.Spec, existingRule.Spec)
	})

	t.Run("list should show created rule with generated name", func(t *testing.T) {
		list, err := client.List(ctx, apis.DefaultNamespace, resource.ListOptions{})
		require.NoError(t, err)
		require.Equal(t, 1, len(list.Items))

		got := list.Items[0]
		require.Equal(t, existingRule.Spec, got.Spec)
	})

	existingIdentifier := existingRule.GetStaticMetadata().Identifier()
	t.Run("get should retrieve rule by name", func(t *testing.T) {
		got, err := client.Get(ctx, existingIdentifier)
		require.NoError(t, err)
		require.Equal(t, existingRule.Spec, got.Spec)
	})

	var updatedRuleIdentifier resource.Identifier
	t.Run("update should keep stable UID and change version", func(t *testing.T) {
		updated := existingRule.DeepCopy()
		updated.Spec.SourceMatchers = append(updated.Spec.SourceMatchers, v0alpha1.InhibitionRuleMatcher{
			Type:  v0alpha1.InhibitionRuleMatcherTypeEqual,
			Label: "severity",
			Value: "critical",
		})

		actual, err := client.Update(ctx, updated, resource.UpdateOptions{})
		require.NoError(t, err)

		updatedRuleIdentifier = actual.GetStaticMetadata().Identifier()

		// Stable UID pattern: Name stays the same, only version changes
		require.Equal(t, existingRule.Name, actual.Name, "Update should keep the same name (stable UID)")
		require.NotEqual(t, existingRule.ResourceVersion, actual.ResourceVersion, "Update should change the resource version")
		require.NotEqual(t, len(existingRule.Spec.SourceMatchers), len(actual.Spec.SourceMatchers), "SourceMatchers count should have changed")

		// Should be able to get the updated resource by same identifier
		updatedRule, err := client.Get(ctx, existingIdentifier)
		require.NoError(t, err)
		require.Equal(t, actual.Spec, updatedRule.Spec)
		require.Equal(t, actual.ResourceVersion, updatedRule.ResourceVersion)
	})

	t.Run("delete should remove rule", func(t *testing.T) {
		err := client.Delete(ctx, updatedRuleIdentifier, resource.DeleteOptions{})
		require.NoError(t, err)

		_, err = client.Get(ctx, updatedRuleIdentifier)
		require.True(t, errors.IsNotFound(err), "Resource should not exist after delete")
	})
}

func TestIntegrationAccessControl(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := getTestHelper(t)

	org1 := helper.Org1

	type testCase struct {
		user      apis.User
		canRead   bool
		canUpdate bool
		canDelete bool
	}

	reader := helper.CreateUser("InhibitionRulesReader", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		createWildcardPermission(accesscontrol.ActionAlertingNotificationsInhibitionRulesRead),
	})
	writer := helper.CreateUser("InhibitionRulesWriter", "Org1", org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		createWildcardPermission(
			accesscontrol.ActionAlertingNotificationsInhibitionRulesRead,
			accesscontrol.ActionAlertingNotificationsInhibitionRulesWrite,
		),
	})

	deleter := helper.CreateUser("InhibitionRulesDeleter", apis.Org1, org.RoleNone, []resourcepermissions.SetResourcePermissionCommand{
		createWildcardPermission(
			accesscontrol.ActionAlertingNotificationsInhibitionRulesRead,
			accesscontrol.ActionAlertingNotificationsInhibitionRulesDelete,
		),
	})

	testCases := []testCase{
		{
			user:      org1.Admin,
			canRead:   true,
			canUpdate: true,
			canDelete: true,
		},
		{
			user:      org1.Editor,
			canRead:   true,
			canUpdate: true,
			canDelete: true,
		},
		{
			user:    org1.Viewer,
			canRead: true,
		},
		{
			user:    reader,
			canRead: true,
		},
		{
			user:      writer,
			canRead:   true,
			canUpdate: true,
		},
		{
			user:      deleter,
			canRead:   true,
			canDelete: true,
		},
	}

	// Create a test rule via admin
	adminClient, err := v0alpha1.NewInhibitionRuleClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
	require.NoError(t, err)

	testRule := &v0alpha1.InhibitionRule{
		ObjectMeta: v1.ObjectMeta{
			Namespace: apis.DefaultNamespace,
			Name:      "test-permission-rule",
		},
		Spec: v0alpha1.InhibitionRuleSpec{
			SourceMatchers: []v0alpha1.InhibitionRuleMatcher{
				{
					Type:  v0alpha1.InhibitionRuleMatcherTypeEqual,
					Label: "alertname",
					Value: "SourceAlert",
				},
			},
			TargetMatchers: []v0alpha1.InhibitionRuleMatcher{
				{
					Type:  v0alpha1.InhibitionRuleMatcherTypeEqual,
					Label: "alertname",
					Value: "TargetAlert",
				},
			},
			Equal: []string{"instance"},
		},
	}
	_, err = adminClient.Create(ctx, testRule, resource.CreateOptions{})
	require.NoError(t, err)

	adminList, err := adminClient.List(ctx, apis.DefaultNamespace, resource.ListOptions{})
	require.NoError(t, err)

	for _, tc := range testCases {
		t.Run(fmt.Sprintf("user '%s'", tc.user.Identity.GetLogin()), func(t *testing.T) {
			client, err := v0alpha1.NewInhibitionRuleClientFromGenerator(tc.user.GetClientRegistry())
			require.NoError(t, err)

			t.Run("list", func(t *testing.T) {
				_, err := client.List(ctx, apis.DefaultNamespace, resource.ListOptions{})
				if tc.canRead {
					require.NoError(t, err)
				} else {
					require.True(t, errors.IsForbidden(err), "Expected Forbidden but got %v", err)
				}
			})

			if len(adminList.Items) == 0 {
				t.Skip("No rules available for permission testing")
			}

			testRule := adminList.Items[0]
			identifier := testRule.GetStaticMetadata().Identifier()

			t.Run("get", func(t *testing.T) {
				_, err := client.Get(ctx, identifier)
				if tc.canRead {
					require.NoError(t, err)
				} else {
					require.True(t, errors.IsForbidden(err), "Expected Forbidden but got %v", err)
				}
			})

			t.Run("update", func(t *testing.T) {
				if !tc.canRead {
					t.Skip("Cannot read resource to update")
				}

				rule, err := client.Get(ctx, identifier)
				require.NoError(t, err)

				updated := rule.DeepCopy()
				updated.Spec.Equal = append(updated.Spec.Equal, "cluster")

				_, err = client.Update(ctx, updated, resource.UpdateOptions{})
				if tc.canUpdate {
					require.NoError(t, err)
				} else {
					require.True(t, errors.IsForbidden(err), "Expected Forbidden but got %v", err)
				}
			})

			t.Run("delete", func(t *testing.T) {
				if !tc.canDelete {
					err := client.Delete(ctx, identifier, resource.DeleteOptions{})
					require.True(t, errors.IsForbidden(err), "Expected Forbidden but got %v", err)
				}
				// Note: Don't actually delete in the canDelete case to preserve test data
			})
		})
	}
}

func createWildcardPermission(actions ...string) resourcepermissions.SetResourcePermissionCommand {
	return resourcepermissions.SetResourcePermissionCommand{
		Actions:           actions,
		Resource:          "inhibition-rules",
		ResourceAttribute: "uid",
		ResourceID:        "*",
	}
}
