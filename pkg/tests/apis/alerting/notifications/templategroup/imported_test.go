package templateGroup

import (
	"context"
	"embed"
	"path"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.yaml.in/yaml/v3"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tests/api/alerting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/notifications/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

//go:embed test-data/*.*
var testData embed.FS

func TestIntegrationImportedTemplates(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			featuremgmt.FlagAlertingImportAlertmanagerAPI,
		},
	})

	client := common.NewTemplateGroupClient(t, helper.Org1.Admin)

	cliCfg := helper.Org1.Admin.NewRestConfig()
	alertingApi := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)

	configYaml, err := testData.ReadFile(path.Join("test-data", "imported.yaml"))
	require.NoError(t, err)

	identifier := "test-create-get-config"
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

	templates, err := client.List(context.Background(), metav1.ListOptions{})

	require.NoError(t, err)
	require.Len(t, templates.Items, 3)

	require.Equal(t, v0alpha1.DefaultTemplateTitle, templates.Items[0].Spec.Title)
	require.Equal(t, "imported", templates.Items[1].Spec.Title)
	require.Equal(t, "template", templates.Items[2].Spec.Title)

	t.Run("should be correct kind", func(t *testing.T) {
		assert.Equal(t,
			v0alpha1.TemplateGroupSpec{
				Title:   "imported",
				Content: amConfig.TemplateFiles["imported"],
				Kind:    v0alpha1.TemplateGroupTemplateKindMimir,
			}, templates.Items[1].Spec)
		assert.Equal(t,
			v0alpha1.TemplateGroupSpec{
				Title:   "template",
				Content: amConfig.TemplateFiles["template"],
				Kind:    v0alpha1.TemplateGroupTemplateKindMimir,
			}, templates.Items[2].Spec)
	})

	t.Run("should be provisioned", func(t *testing.T) {
		for _, tpl := range templates.Items[1:] {
			assert.EqualValues(t, models.ProvenanceConvertedPrometheus, tpl.GetProvenanceStatus())
		}
	})

	t.Run("should not be able to update", func(t *testing.T) {
		tpl := templates.Items[1]
		tpl.Spec.Content = "new content"
		_, err := client.Update(context.Background(), &tpl, metav1.UpdateOptions{})
		require.Truef(t, errors.IsBadRequest(err), "expected bad request but got %s", err)
	})

	t.Run("should not be able to delete", func(t *testing.T) {
		err := client.Delete(context.Background(), templates.Items[1].Name, metav1.DeleteOptions{})
		require.Truef(t, errors.IsBadRequest(err), "expected bad request but got %s", err)
	})

	t.Run("should not conflict with Grafana kind", func(t *testing.T) {
		tpl := v0alpha1.TemplateGroup{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "default",
			},
			Spec: templates.Items[1].Spec,
		}
		tpl.Spec.Kind = v0alpha1.TemplateGroupTemplateKindGrafana

		created, err := client.Create(context.Background(), &tpl, metav1.CreateOptions{})
		require.NoError(t, err)

		assert.NotEqual(t, templates.Items[1].Name, created.Name)
	})

	t.Run("sort by kind and then name", func(t *testing.T) {
		templates, err := client.List(context.Background(), metav1.ListOptions{})

		require.NoError(t, err)
		require.Len(t, templates.Items, 4)
		assert.Equal(t, v0alpha1.DefaultTemplateTitle, templates.Items[0].Spec.Title)
		assert.Equal(t, "imported", templates.Items[1].Spec.Title)
		assert.Equal(t, v0alpha1.TemplateGroupTemplateKindGrafana, templates.Items[1].Spec.Kind)
		assert.Equal(t, "imported", templates.Items[2].Spec.Title)
		assert.Equal(t, v0alpha1.TemplateGroupTemplateKindMimir, templates.Items[2].Spec.Kind)
		assert.Equal(t, "template", templates.Items[3].Spec.Title)
	})
}
