package config

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
	unified "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationOrgDeletionCleansRulesAndConfigInTargetOrg(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			"alertrules.rules.alerting.grafana.app": {DualWriterMode: rest.Mode4},
		},
		UnifiedAlertingDisableExecuteAlerts: true,
	})
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	seedSingleton(t, ctx, helper)
	targetNamespace := helper.Namespacer(helper.OrgB.OrgID)
	targetClient := newConfigClient(t, helper.OrgB.Admin)
	require.Eventually(t, func() bool {
		_, err := targetClient.Get(ctx, resource.Identifier{Namespace: targetNamespace, Name: model.ConfigSingletonName})
		return err == nil
	}, 30*time.Second, 200*time.Millisecond, "sync worker did not seed the target org Config")
	serviceCtx := identity.WithServiceIdentityContext(ctx, helper.OrgB.OrgID)
	key := &resourcepb.ResourceKey{Namespace: targetNamespace, Group: configGVR.Group, Resource: configGVR.Resource, Name: model.ConfigSingletonName}
	stored, err := helper.GetEnv().ResourceClient.Read(serviceCtx, &resourcepb.ReadRequest{Key: key})
	require.NoError(t, unified.ErrorFromResponse(stored.GetError(), err))

	// Use identical rule names in both orgs to detect cross-tenant deletion.
	for _, orgUsers := range []apis.OrgUsers{helper.Org1, helper.OrgB} {
		namespace := helper.Namespacer(orgUsers.OrgID)
		folderClient := &apis.TypedClient[folderv1.Folder, folderv1.FolderList]{
			Client: orgUsers.Admin.ResourceClient(t, folderv1.FolderKind().GroupVersionResource()).Namespace(namespace),
		}
		_, err := folderClient.Create(ctx, &folderv1.Folder{
			ObjectMeta: metav1.ObjectMeta{Name: "rule-folder", Namespace: namespace},
			Spec:       folderv1.FolderSpec{Title: "Rule folder"},
		}, metav1.CreateOptions{})
		require.NoError(t, err)
		ruleClient := &apis.TypedClient[model.AlertRule, model.AlertRuleList]{
			Client: orgUsers.Admin.ResourceClient(t, model.AlertRuleKind().GroupVersionResource()).Namespace(namespace),
		}
		base := ngmodels.RuleGen.With(ngmodels.RuleMuts.WithIntervalMatching(10 * time.Second)).Generate()
		_, err = ruleClient.Create(ctx, &model.AlertRule{
			ObjectMeta: metav1.ObjectMeta{
				Name: "org-rule", Namespace: namespace,
				Annotations: map[string]string{model.FolderAnnotationKey: "rule-folder"},
			},
			Spec: model.AlertRuleSpec{
				Title: "Org rule", NoDataState: "NoData", ExecErrState: "Error",
				Trigger: model.AlertRuleIntervalTrigger{Interval: "10s"},
				Expressions: model.AlertRuleExpressionMap{"A": {
					QueryType: new(base.Data[0].QueryType), DatasourceUID: new(model.AlertRuleDatasourceUID(base.Data[0].DatasourceUID)),
					Model: base.Data[0].Model, Source: new(true),
					RelativeTimeRange: &model.AlertRuleRelativeTimeRange{From: "5m", To: "0s"},
				}},
			},
		}, metav1.CreateOptions{})
		require.NoError(t, err)
	}
	ruleKey := &resourcepb.ResourceKey{Namespace: targetNamespace, Group: model.APIGroup, Resource: "alertrules", Name: "org-rule"}
	stored, err = helper.GetEnv().ResourceClient.Read(serviceCtx, &resourcepb.ReadRequest{Key: ruleKey})
	require.NoError(t, unified.ErrorFromResponse(stored.GetError(), err))

	response := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodDelete,
		Path:   fmt.Sprintf("/api/orgs/%d", helper.OrgB.OrgID),
	}, &struct{}{})
	require.Equal(t, http.StatusOK, response.Response.StatusCode, string(response.Body))

	// The server admin remains in org 1, so this also exercises the service
	// identity's tenant switch through the real org deletion and API handlers.
	_, err = newConfigClient(t, helper.Org1.Admin).Get(ctx, singletonID)
	require.NoError(t, err, "deleting another org must preserve org 1's Config")
	_, err = helper.Org1.Admin.ResourceClient(t, model.AlertRuleKind().GroupVersionResource()).Namespace(helper.Namespacer(helper.Org1.OrgID)).Get(ctx, "org-rule", metav1.GetOptions{})
	require.NoError(t, err, "deleting another org must preserve org 1's rules")
	stored, err = helper.GetEnv().ResourceClient.Read(serviceCtx, &resourcepb.ReadRequest{Key: ruleKey})
	ruleErr := unified.ErrorFromResponse(stored.GetError(), err)
	require.Error(t, ruleErr, "org deletion must remove alert rules from unified storage")
	ruleResult := unified.AsErrorResult(ruleErr)
	require.NotNil(t, ruleResult)
	require.Equal(t, int32(http.StatusNotFound), ruleResult.Code)
	stored, err = helper.GetEnv().ResourceClient.Read(serviceCtx, &resourcepb.ReadRequest{Key: key})
	readErr := unified.ErrorFromResponse(stored.GetError(), err)
	require.Error(t, readErr)
	result := unified.AsErrorResult(readErr)
	require.NotNil(t, result)
	require.Equal(t, int32(http.StatusNotFound), result.Code)
}
