package inhibitionrule

import (
	"context"
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
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tests/api/alerting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationImportedInhibitionRules(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			featuremgmt.FlagAlertingImportAlertmanagerAPI,
		},
	})

	client, err := v0alpha1.NewInhibitionRuleClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
	require.NoError(t, err)

	cliCfg := helper.Org1.Admin.NewRestConfig()
	alertingApi := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)

	configYaml, err := testData.ReadFile(path.Join("test-data", "imported.yaml"))
	require.NoError(t, err)

	identifier := "test-imported-inhibition-rules"
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

	inhibitionRules, err := client.List(context.Background(), apis.DefaultNamespace, resource.ListOptions{})
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(inhibitionRules.Items), 2, "should have at least 2 imported inhibition rules")

	// Find imported rules (they should have SubtreeMatchers added)
	var importedRules []*v0alpha1.InhibitionRule
	for i := range inhibitionRules.Items {
		rule := &inhibitionRules.Items[i]
		// Check if rule has the SubtreeMatcher (_imported=true)
		hasSubtreeMatcher := false
		for _, matcher := range rule.Spec.SourceMatchers {
			if matcher.Label == "_imported" && matcher.Value == "true" {
				hasSubtreeMatcher = true
				break
			}
		}
		if hasSubtreeMatcher {
			importedRules = append(importedRules, rule)
		}
	}

	require.Equal(t, len(importedRules), 2, "should find 2 imported inhibition rules")

	t.Run("should be provisioned with converted prometheus provenance", func(t *testing.T) {
		for _, rule := range importedRules {
			assert.EqualValues(t, models.ProvenanceConvertedPrometheus, rule.GetProvenanceStatus(),
				"Rule %s should have ProvenanceConvertedPrometheus", rule.Name)
		}
	})

	t.Run("should have SubtreeMatchers added to both source and target", func(t *testing.T) {
		for _, rule := range importedRules {
			// Check source matchers
			hasSubtree := false
			for _, matcher := range rule.Spec.SourceMatchers {
				if matcher.Label == "_imported" && matcher.Value == "true" {
					hasSubtree = true
					break
				}
			}
			assert.True(t, hasSubtree, "Rule %s should have SubtreeMatcher in SourceMatchers", rule.Name)

			// Check target matchers
			hasSubtree = false
			for _, matcher := range rule.Spec.TargetMatchers {
				if matcher.Label == "_imported" && matcher.Value == "true" {
					hasSubtree = true
					break
				}
			}
			assert.True(t, hasSubtree, "Rule %s should have SubtreeMatcher in TargetMatchers", rule.Name)
		}
	})

	t.Run("should not be able to update", func(t *testing.T) {
		if len(importedRules) == 0 {
			t.Skip("No imported rules to test")
		}

		rule := importedRules[0].DeepCopy()
		rule.Spec.Equal = append(rule.Spec.Equal, "newlabel")

		_, err := client.Update(context.Background(), rule, resource.UpdateOptions{})
		require.Truef(t, errors.IsBadRequest(err), "expected bad request but got %s", err)
		assert.ErrorContains(t, err, "cannot be updated because it belongs to an imported configuration")
	})

	t.Run("should not be able to delete", func(t *testing.T) {
		if len(importedRules) == 0 {
			t.Skip("No imported rules to test")
		}

		err := client.Delete(context.Background(), importedRules[0].GetStaticMetadata().Identifier(), resource.DeleteOptions{})
		require.Truef(t, errors.IsBadRequest(err), "expected bad request but got %s", err)
		assert.ErrorContains(t, err, "cannot be deleted because it belongs to an imported configuration")
	})
}
