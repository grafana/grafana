package compat

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tests/api/alerting"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/rules/common"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
	prom_model "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationRecordingRuleCompatCreateViaK8s(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := common.GetTestHelper(t)

	k8sClient := common.NewRecordingRuleClient(t, helper.Org1.Admin)

	legacyClient := alerting.NewAlertingLegacyAPIClient(helper.GetListenerAddress(), "admin", "admin")

	// Ensure the old provisioning API is enabled
	allRules, status, _ := legacyClient.GetAllRulesWithStatus(t)
	require.Equal(t, 200, status)
	require.NotNil(t, allRules)

	// Create test folder first
	common.CreateTestFolder(t, helper, "test-folder")

	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithNamespaceUID("test-folder"),
		ngmodels.RuleMuts.WithGroupName("test-group"),
		ngmodels.RuleMuts.WithAllRecordingRules(),
		ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
	).Generate()

	recordingRule := &v0alpha1.RecordingRule{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
			Annotations: map[string]string{
				"grafana.app/folder": "test-folder",
				// use provenance api to allow use of the provisioning api
				"grafana.com/provenance": string(ngmodels.ProvenanceAPI),
			},
		},
		Spec: v0alpha1.RecordingRuleSpec{
			Title:  rule.Title,
			Metric: rule.Record.Metric,
			Data: map[string]v0alpha1.RecordingRuleQuery{
				"A": {
					QueryType:     "query",
					DatasourceUID: v0alpha1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID),
					Model:         rule.Data[0].Model,
					Source:        util.Pointer(true),
					RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{
						From: v0alpha1.RecordingRulePromDurationWMillis("5m"),
						To:   v0alpha1.RecordingRulePromDurationWMillis("0s"),
					},
				},
			},
			Trigger: v0alpha1.RecordingRuleIntervalTrigger{
				Interval: v0alpha1.RecordingRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
			},
		},
	}

	created, err := k8sClient.Create(ctx, recordingRule, v1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, created)

	t.Run("should be able to use the provisioning API with this rule", func(t *testing.T) {
		retrievedRule, status, _ := legacyClient.GetProvisioningAlertRule(t, created.Name)
		require.NotNil(t, retrievedRule)
		require.Equal(t, 200, status)
		require.Equal(t, created.Spec.Title, retrievedRule.Title)
		require.Equal(t, created.Spec.Metric, retrievedRule.Record.Metric)
		require.Equal(t, "A", retrievedRule.Data[0].RefID)

		model := map[string]interface{}{}
		err := json.Unmarshal(retrievedRule.Data[0].Model, &model)
		require.NoError(t, err)
		require.NotNil(t, model)
		expectedModel, ok := created.Spec.Data["A"].Model.(map[string]interface{})
		if !ok {
			t.Fatalf("Expected model to be a map[string]interface{}, got %T", created.Spec.Data["A"].Model)
		}
		for k, v := range expectedModel {
			require.EqualValues(t, v, model[k], "Model field %s should match", k)
		}
		require.Equal(t, created.Annotations["grafana.app/folder"], retrievedRule.FolderUID)

		// get the group to get the interval
		group, status, _ := legacyClient.GetRuleGroupProvisioning(t, retrievedRule.FolderUID, retrievedRule.RuleGroup)
		require.NotNil(t, group)
		require.Equal(t, 200, status)
		parsedDuration, err := prom_model.ParseDuration(fmt.Sprintf("%ds", group.Interval))
		require.NoError(t, err)
		require.Equal(t, string(created.Spec.Trigger.Interval), parsedDuration.String())

		// try to update the rule group title via the provisioning api
		groupNameUpdate := group
		groupNameUpdate.Title = "New Group Name"
		// this should be rejected
		_, status, data := legacyClient.CreateOrUpdateRuleGroupProvisioning(t, groupNameUpdate)
		require.Equalf(t, 400, status, "Expected status 400 when changing group name, got %d. Data: %s", status, data)
		// verify the group name didn't
		retrievedRule, status, _ = legacyClient.GetProvisioningAlertRule(t, created.Name)
		require.NotNil(t, retrievedRule)
		require.Equal(t, 200, status)
		require.Equal(t, group.Title, retrievedRule.RuleGroup)

		// successful update
		groupUpdate := group
		groupUpdate.Rules[0].Title = "Updated " + groupUpdate.Rules[0].Title
		updatedRule, status, _ := legacyClient.CreateOrUpdateRuleGroupProvisioning(t, groupUpdate)
		require.Equal(t, 200, status)
		require.NotNil(t, updatedRule)
		require.Equal(t, groupUpdate.Rules[0].Title, updatedRule.Rules[0].Title)

		// verify the change is reflected in k8s
		k8sRetrievedRule, err := k8sClient.Get(ctx, created.Name, v1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, k8sRetrievedRule)
		require.Equal(t, updatedRule.Rules[0].Title, k8sRetrievedRule.Spec.Title)

		// delete the rule group via the provisioning API
		status, body := legacyClient.DeleteRulesGroupProvisioning(t, group.FolderUID, group.Title)
		require.Equalf(t, 204, status, "Expected status 200 when deleting rule group, got %d. Body: %s", status, body)
		// verify the rule is deleted in k8s
		_, err = k8sClient.Get(ctx, created.Name, v1.GetOptions{})
		require.Error(t, err, "Expected error when getting deleted rule")
		require.Contains(t, err.Error(), "not found")
	})
}

func TestIntegrationRecordingRuleCompatCreateViaProvisioning(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := common.GetTestHelper(t)

	k8sClient := common.NewRecordingRuleClient(t, helper.Org1.Admin)

	legacyClient := alerting.NewAlertingLegacyAPIClient(helper.GetListenerAddress(), "admin", "admin")

	// Ensure the old provisioning API is enabled
	allRules, status, _ := legacyClient.GetAllRulesWithStatus(t)
	require.Equal(t, 200, status)
	require.NotNil(t, allRules)

	// Create test folder first
	common.CreateTestFolder(t, helper, "test-folder")

	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithNamespaceUID("test-folder"),
		ngmodels.RuleMuts.WithGroupName("test-group"),
		ngmodels.RuleMuts.WithAllRecordingRules(),
		ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
	).GenerateMany(2)

	ruleGroup := apimodels.AlertRuleGroup{
		Title:     "test-group",
		FolderUID: "test-folder",
		Interval:  rule[0].IntervalSeconds,
		Rules: []apimodels.ProvisionedAlertRule{
			{
				UID:   rule[0].UID,
				Title: rule[0].Title,
				OrgID: 1,
				Data: []apimodels.AlertQuery{
					{
						RefID:         "A",
						DatasourceUID: rule[0].Data[0].DatasourceUID,
						Model:         rule[0].Data[0].Model,
						RelativeTimeRange: apimodels.RelativeTimeRange{
							From: apimodels.Duration(time.Duration(5) * time.Minute),
							To:   apimodels.Duration(0),
						},
					},
				},
				Record: &apimodels.Record{
					Metric:              rule[0].Record.Metric,
					From:                "A",
					TargetDatasourceUID: rule[0].Record.TargetDatasourceUID,
				},
				FolderUID: "test-folder",
			},
			{
				UID:   rule[1].UID,
				Title: rule[1].Title,
				OrgID: 1,
				Data: []apimodels.AlertQuery{
					{
						RefID:         "A",
						DatasourceUID: rule[1].Data[0].DatasourceUID,
						Model:         rule[1].Data[0].Model,
						RelativeTimeRange: apimodels.RelativeTimeRange{
							From: apimodels.Duration(time.Duration(5) * time.Minute),
							To:   apimodels.Duration(0),
						},
					},
				},
				Record: &apimodels.Record{
					Metric:              rule[1].Record.Metric,
					From:                "A",
					TargetDatasourceUID: rule[1].Record.TargetDatasourceUID,
				},
				FolderUID: "test-folder",
			},
		},
	}

	created, status, body := legacyClient.CreateOrUpdateRuleGroupProvisioning(t, ruleGroup)
	require.Equalf(t, 200, status, "Expected status 200, got %d. Response body: %s", status, body)
	require.NotNil(t, created)

	t.Run("should be able to use the k8s API with these rules", func(t *testing.T) {
		for i, r := range created.Rules {
			retrievedRule, err := k8sClient.Get(ctx, r.UID, v1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, retrievedRule)
			require.Equal(t, r.Title, retrievedRule.Spec.Title)
			require.Equal(t, r.Record.Metric, retrievedRule.Spec.Metric)
			require.Equal(t, r.FolderUID, retrievedRule.Annotations["grafana.app/folder"])
			require.Equal(t, created.Title, retrievedRule.Labels[v0alpha1.GroupLabelKey])
			require.Equal(t, fmt.Sprintf("%d", i), retrievedRule.Labels[v0alpha1.GroupIndexLabelKey])
			require.Equal(t, ngmodels.ProvenanceAPI, ngmodels.Provenance(retrievedRule.GetProvenanceStatus()))
			require.EqualValues(t, r.Data[0].DatasourceUID, retrievedRule.Spec.Data["A"].DatasourceUID)
			expectedDuration, err := prom_model.ParseDuration(fmt.Sprintf("%ds", created.Interval))
			require.NoError(t, err)
			require.Equal(t, expectedDuration.String(), string(retrievedRule.Spec.Trigger.Interval))
			expectedModel := map[string]interface{}{}
			err = json.Unmarshal(r.Data[0].Model, &expectedModel)
			require.NoError(t, err)
			require.NotNil(t, expectedModel)
			retrievedModel, ok := retrievedRule.Spec.Data["A"].Model.(map[string]interface{})
			if !ok {
				t.Fatalf("Expected model to be a map[string]interface{}, got %T", retrievedRule.Spec.Data["A"].Model)
			}
			for k, v := range expectedModel {
				require.EqualValues(t, v, retrievedModel[k], "Model field %s should match", k)
			}

			// change the title of the rule and check that it's updated in k8s and provisioning API
			updatedRule := retrievedRule.DeepCopy()
			updatedRule.Spec.Title = "Updated " + retrievedRule.Spec.Title
			updatedRule, err = k8sClient.Update(ctx, updatedRule, v1.UpdateOptions{})
			require.NoError(t, err)
			require.NotNil(t, updatedRule)

			retrievedRule, err = k8sClient.Get(ctx, r.UID, v1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, retrievedRule)
			require.Equal(t, updatedRule.Spec.Title, retrievedRule.Spec.Title)

			provisioningRetrievedRule, status, _ := legacyClient.GetProvisioningAlertRule(t, r.UID)
			require.NotNil(t, provisioningRetrievedRule)
			require.Equal(t, 200, status)
			require.Equal(t, updatedRule.Spec.Title, provisioningRetrievedRule.Title)

			// delete the rule via k8s
			err = k8sClient.Delete(ctx, retrievedRule.Name, v1.DeleteOptions{})
			require.NoError(t, err)
			// check that the rule is deleted in the provisioning API
			_, status, body := legacyClient.GetProvisioningAlertRule(t, r.UID)
			require.Equal(t, 404, status, "Expected status 404, got %d. Response body: %s", status, body)

			// check that the rule is deleted in k8s
			_, err = k8sClient.Get(ctx, r.UID, v1.GetOptions{})
			require.Error(t, err, "Expected error when getting deleted rule")
			require.Contains(t, err.Error(), "not found", "Expected 'not found' error, got %s", err.Error())
		}
	})
}

func TestIntegrationRecordingRuleCompatCreateViaProvisioningChangeGroupInK8s(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	helper := common.GetTestHelper(t)

	k8sClient := common.NewRecordingRuleClient(t, helper.Org1.Admin)

	legacyClient := alerting.NewAlertingLegacyAPIClient(helper.GetListenerAddress(), "admin", "admin")

	// Ensure the old provisioning API is enabled
	allRules, status, _ := legacyClient.GetAllRulesWithStatus(t)
	require.Equal(t, 200, status)
	require.NotNil(t, allRules)

	// Create test folder first
	common.CreateTestFolder(t, helper, "test-folder")

	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithNamespaceUID("test-folder"),
		ngmodels.RuleMuts.WithGroupName("test-group"),
		ngmodels.RuleMuts.WithAllRecordingRules(),
		ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
	).GenerateMany(2)

	ruleGroup := apimodels.AlertRuleGroup{
		Title:     "test-group",
		FolderUID: "test-folder",
		Interval:  rule[0].IntervalSeconds,
		Rules: []apimodels.ProvisionedAlertRule{
			{
				UID:   rule[0].UID,
				Title: rule[0].Title,
				OrgID: 1,
				Data: []apimodels.AlertQuery{
					{
						RefID:         "X",
						DatasourceUID: rule[0].Data[0].DatasourceUID,
						Model:         rule[0].Data[0].Model,
						RelativeTimeRange: apimodels.RelativeTimeRange{
							From: apimodels.Duration(time.Duration(5) * time.Minute),
							To:   apimodels.Duration(0),
						},
					},
				},
				Record: &apimodels.Record{
					Metric:              rule[0].Record.Metric,
					From:                "X",
					TargetDatasourceUID: rule[0].Record.TargetDatasourceUID,
				},
				FolderUID: "test-folder",
			},
			{
				UID:   rule[1].UID,
				Title: rule[1].Title,
				OrgID: 1,
				Data: []apimodels.AlertQuery{
					{
						RefID:         "X",
						DatasourceUID: rule[1].Data[0].DatasourceUID,
						Model:         rule[1].Data[0].Model,
						RelativeTimeRange: apimodels.RelativeTimeRange{
							From: apimodels.Duration(time.Duration(5) * time.Minute),
							To:   apimodels.Duration(0),
						},
					},
				},
				Record: &apimodels.Record{
					Metric:              rule[1].Record.Metric,
					From:                "X",
					TargetDatasourceUID: rule[1].Record.TargetDatasourceUID,
				},
				FolderUID: "test-folder",
			},
		},
	}

	created, status, body := legacyClient.CreateOrUpdateRuleGroupProvisioning(t, ruleGroup)
	require.Equalf(t, 200, status, "Expected status 200, got %d. Response body: %s", status, body)
	require.NotNil(t, created)

	t.Run("should be able to use the k8s API to change the group for a rule", func(t *testing.T) {
		for i, r := range created.Rules {
			retrievedRule, err := k8sClient.Get(ctx, r.UID, v1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, retrievedRule)
			require.Equal(t, r.Title, retrievedRule.Spec.Title)
			require.Equal(t, r.Record.Metric, retrievedRule.Spec.Metric)
			require.Equal(t, r.FolderUID, retrievedRule.Annotations["grafana.app/folder"])
			require.Equal(t, created.Title, retrievedRule.Labels[v0alpha1.GroupLabelKey])
			require.Equal(t, fmt.Sprintf("%d", i), retrievedRule.Labels[v0alpha1.GroupIndexLabelKey])
			require.Equal(t, ngmodels.ProvenanceAPI, ngmodels.Provenance(retrievedRule.GetProvenanceStatus()))
			require.EqualValues(t, r.Data[0].DatasourceUID, retrievedRule.Spec.Data["X"].DatasourceUID)
			expectedDuration, err := prom_model.ParseDuration(fmt.Sprintf("%ds", created.Interval))
			require.NoError(t, err)
			require.Equal(t, expectedDuration.String(), string(retrievedRule.Spec.Trigger.Interval))
			expectedModel := map[string]interface{}{}
			err = json.Unmarshal(r.Data[0].Model, &expectedModel)
			require.NoError(t, err)
			require.NotNil(t, expectedModel)
			retrievedModel, ok := retrievedRule.Spec.Data["X"].Model.(map[string]interface{})
			if !ok {
				t.Fatalf("Expected model to be a map[string]interface{}, got %T", retrievedRule.Spec.Data["X"].Model)
			}
			for k, v := range expectedModel {
				require.EqualValues(t, v, retrievedModel[k], "Model field %s should match", k)
			}

			// - change group should be allowed and reflected in the provisioning api
			updatedRule := retrievedRule.DeepCopy()
			updatedRule.Labels[v0alpha1.GroupLabelKey] = "new-group"
			updatedRule, err = k8sClient.Update(ctx, updatedRule, v1.UpdateOptions{})
			require.NoError(t, err)
			require.NotNil(t, updatedRule)

			// verify the change is reflected in k8s
			retrievedRule, err = k8sClient.Get(ctx, r.UID, v1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, retrievedRule)
			// verify the group label changed
			require.Equal(t, "new-group", retrievedRule.Labels[v0alpha1.GroupLabelKey])

			// verify the change is reflected in the provisioning API
			provisioningRetrievedRule, status, _ := legacyClient.GetProvisioningAlertRule(t, r.UID)
			require.NotNil(t, provisioningRetrievedRule)
			require.Equal(t, 200, status)
			// verify the group label changed
			require.Equal(t, "new-group", provisioningRetrievedRule.RuleGroup)
		}
	})
}
