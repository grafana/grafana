package inhibitionrule

import (
	"context"
	"embed"
	"encoding/json"
	"path"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"
	"k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/tests/api/alerting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

//go:embed test-data/*.*
var testData embed.FS

func TestIntegrationImportedInhibitionRules(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			featuremgmt.FlagAlertingImportAlertmanagerAPI,
			featuremgmt.FlagAlertingMultiplePolicies,
		},
	})

	ctx := context.Background()

	cliCfg := helper.Org1.Admin.NewRestConfig()
	alertingApi := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)

	client, err := v0alpha1.NewInhibitionRuleClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
	require.NoError(t, err)

	configYaml, err := testData.ReadFile(path.Join("test-data", "imported.yaml"))
	require.NoError(t, err)

	identifier := "integration-test"
	mergeMatchers := "_imported=true"

	headers := map[string]string{
		"Content-Type":                         "application/yaml",
		"X-Grafana-Alerting-Config-Identifier": identifier,
		"X-Grafana-Alerting-Merge-Matchers":    mergeMatchers,
	}

	var amConfig apimodels.AlertmanagerUserConfig
	require.NoError(t, yaml.Unmarshal(configYaml, &amConfig))

	response := alertingApi.ConvertPrometheusPostAlertmanagerConfig(t, amConfig, headers)
	require.Equal(t, "success", response.Status)

	inhibitionRules, err := client.List(ctx, apis.DefaultNamespace, resource.ListOptions{})
	require.NoError(t, err)
	require.Len(t, inhibitionRules.Items, 2, "expected exactly two imported inhibition rules")

	importedRule := inhibitionRules.Items[0]

	t.Run("list should return all imported inhibition rules", func(t *testing.T) {
		got, err := json.MarshalIndent(inhibitionRules, "", "  ")
		require.NoError(t, err)

		exp, err := testData.ReadFile(path.Join("test-data", "list.json"))
		require.NoError(t, err)

		require.JSONEq(t, string(exp), string(got), "response should match expected snapshot")
	})

	t.Run("should not be able to update imported inhibition rules", func(t *testing.T) {
		rule := importedRule.DeepCopy()
		rule.Spec.Equal = append(rule.Spec.Equal, "newlabel")

		_, err := client.Update(context.Background(), rule, resource.UpdateOptions{})
		require.Truef(t, errors.IsBadRequest(err), "expected bad request but got %s", err)
		assert.ErrorContains(t, err, "cannot be updated because it belongs to an imported configuration")
	})

	t.Run("should not be able to delete imported inhibition rules", func(t *testing.T) {
		err := client.Delete(context.Background(), importedRule.GetStaticMetadata().Identifier(), resource.DeleteOptions{})
		require.Truef(t, errors.IsBadRequest(err), "expected bad request but got %s", err)
		assert.ErrorContains(t, err, "cannot be deleted because it belongs to an imported configuration")
	})
}
