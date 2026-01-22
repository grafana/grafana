package timeinterval

import (
	"context"
	"fmt"
	"path"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
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
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationImportedTimeIntervals(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			featuremgmt.FlagAlertingImportAlertmanagerAPI,
		},
	})

	client, err := v0alpha1.NewTimeIntervalClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
	require.NoError(t, err)

	cliCfg := helper.Org1.Admin.NewRestConfig()
	alertingApi := alerting.NewAlertingLegacyAPIClient(helper.GetEnv().Server.HTTPServer.Listener.Addr().String(), cliCfg.Username, cliCfg.Password)

	configYaml, err := testData.ReadFile(path.Join("test-data", "imported.yaml"))
	require.NoError(t, err)

	identifier := "-test-imported-time-intervals"
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

	timeIntervals, err := client.List(context.Background(), apis.DefaultNamespace, resource.ListOptions{})

	require.NoError(t, err)
	require.GreaterOrEqual(t, len(timeIntervals.Items), 2, "should have at least 2 imported time intervals")

	// Find our imported intervals
	var businessHours, weekends *v0alpha1.TimeInterval
	for i := range timeIntervals.Items {
		switch name := timeIntervals.Items[i].Spec.Name; name {
		case "business-hours":
			businessHours = &timeIntervals.Items[i]
		case "weekends":
			weekends = &timeIntervals.Items[i]
		}
	}

	require.NotNil(t, businessHours, "business-hours interval not found")
	require.NotNil(t, weekends, "weekends interval not found")

	t.Run("should be provisioned with converted prometheus provenance", func(t *testing.T) {
		assert.EqualValues(t, models.ProvenanceConvertedPrometheus, businessHours.GetProvenanceStatus())
		assert.EqualValues(t, models.ProvenanceConvertedPrometheus, weekends.GetProvenanceStatus())
	})

	t.Run("should have correct canUse annotation", func(t *testing.T) {
		assert.Equal(t, "false", businessHours.Annotations[v0alpha1.CanUseAnnotationKey])
		assert.Equal(t, "false", weekends.Annotations[v0alpha1.CanUseAnnotationKey])
	})

	t.Run("should not be able to update", func(t *testing.T) {
		interval := *businessHours
		if len(interval.Spec.TimeIntervals) > 0 && len(interval.Spec.TimeIntervals[0].Times) > 0 {
			interval.Spec.TimeIntervals[0].Times[0].StartTime = "08:00"
		}

		_, err := client.Update(context.Background(), &interval, resource.UpdateOptions{})
		require.Truef(t, errors.IsBadRequest(err), "expected bad request but got %s", err)
	})

	t.Run("should not be able to delete", func(t *testing.T) {
		err := client.Delete(context.Background(), businessHours.GetStaticMetadata().Identifier(), resource.DeleteOptions{})
		require.Truef(t, errors.IsBadRequest(err), "expected bad request but got %s", err)
	})

	t.Run("should allow duplicate names across Grafana and imported intervals", func(t *testing.T) {
		// Create a Grafana time interval with the same name as an imported one
		interval := v0alpha1.TimeInterval{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "default",
			},
			Spec: v0alpha1.TimeIntervalSpec{
				Name: "business-hours",
				TimeIntervals: []v0alpha1.TimeIntervalInterval{
					{
						Times: []v0alpha1.TimeIntervalTimeRange{
							{
								StartTime: "10:00",
								EndTime:   "16:00",
							},
						},
					},
				},
			},
		}

		createdInterval, err := client.Create(context.Background(), &interval, resource.CreateOptions{})
		require.Nil(t, err)
		require.Equal(t, "business-hours", createdInterval.Spec.Name)

		timeIntervals, err := client.List(context.Background(), apis.DefaultNamespace, resource.ListOptions{})
		require.Nil(t, err)
		require.GreaterOrEqual(t, len(timeIntervals.Items), 3, "should have at least 3 time intervals after creating duplicate name")

		var foundRenamed bool
		for _, ti := range timeIntervals.Items {
			if ti.Spec.Name == "business-hours"+identifier && ti.GetProvenanceStatus() == string(models.ProvenanceConvertedPrometheus) {
				foundRenamed = true
			}
		}
		require.True(t, foundRenamed, fmt.Sprintf("expected to find renamed imported time interval with name %q", "business-hours"+identifier))
	})
}
