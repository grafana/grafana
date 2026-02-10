package routingtree

import (
	"context"
	"embed"
	"path"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tests/api/alerting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/testutil"
)

//go:embed test-data/*.*
var testData embed.FS

func TestIntegrationReadImported_Snapshot(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	ctx := context.Background()

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			featuremgmt.FlagAlertingImportAlertmanagerAPI,
			featuremgmt.FlagAlertingMultiplePolicies,
		},
	})

	client, err := v0alpha1.NewRoutingTreeClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
	require.NoError(t, err)

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

	amConfig := apimodels.AlertmanagerUserConfig{
		AlertmanagerConfig: string(configYaml),
	}

	response := alertingApi.ConvertPrometheusPostAlertmanagerConfig(t, amConfig, headers)
	require.Equal(t, "success", response.Status)

	routes, err := client.List(ctx, apis.DefaultNamespace, resource.ListOptions{})
	require.NoError(t, err)
	require.Len(t, routes.Items, 2)
	var importedRoute *v0alpha1.RoutingTree
	for _, r := range routes.Items {
		if r.Name == identifier {
			importedRoute = &r
		}
	}
	require.NotNil(t, importedRoute)
	expected := &v0alpha1.RoutingTree{
		ObjectMeta: v1.ObjectMeta{
			Name:            identifier,
			Namespace:       apis.DefaultNamespace,
			ResourceVersion: "624f4696d803bc64",
		},
		Spec: v0alpha1.RoutingTreeSpec{
			Defaults: v0alpha1.RoutingTreeRouteDefaults{
				GroupBy:       []string{"alertname", "cluster"},
				GroupWait:     util.Pointer("1s"),
				GroupInterval: util.Pointer("5s"),
				Receiver:      "noop",
			},
			Routes: []v0alpha1.RoutingTreeRoute{
				{
					Receiver:          util.Pointer("noop-warn"),
					Matchers:          []v0alpha1.RoutingTreeMatcher{{Label: "severity", Type: v0alpha1.RoutingTreeMatcherTypeEqual, Value: "warn"}},
					MuteTimeIntervals: []string{"mute-interval-1"},
				},
				{
					Receiver:            util.Pointer("noop-critical"),
					Matchers:            []v0alpha1.RoutingTreeMatcher{{Label: "severity", Type: v0alpha1.RoutingTreeMatcherTypeEqual, Value: "critical"}},
					ActiveTimeIntervals: []string{"time-interval-1"},
				},
			},
		},
	}
	expected.UID = importedRoute.UID // UID is generated.
	expected.SetProvenanceStatus(string(models.ProvenanceConvertedPrometheus))
	require.Equal(t, expected, importedRoute)

	t.Run("should not be able to update", func(t *testing.T) {
		toUpdate := importedRoute.Copy().(*v0alpha1.RoutingTree)
		toUpdate.Spec.Defaults.GroupWait = util.Pointer("10s")

		_, err = client.Update(ctx, toUpdate, resource.UpdateOptions{})
		require.Truef(t, errors.IsBadRequest(err), "Expected BadRequest but got %s", err)
		require.ErrorContains(t, err, "imported configuration")
	})

	t.Run("should not be able to delete", func(t *testing.T) {
		toDelete := importedRoute.Copy().(*v0alpha1.RoutingTree)

		err = client.Delete(ctx, toDelete.GetStaticMetadata().Identifier(), resource.DeleteOptions{})
		require.Truef(t, errors.IsBadRequest(err), "Expected BadRequest but got %s", err)
		require.ErrorContains(t, err, "imported configuration")
	})

	t.Run("should not return if flag is disabled", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			EnableFeatureToggles: []string{
				featuremgmt.FlagAlertingMultiplePolicies,
			},
		})

		client, err := v0alpha1.NewRoutingTreeClientFromGenerator(helper.Org1.Admin.GetClientRegistry())
		require.NoError(t, err)

		routes, err := client.List(ctx, apis.DefaultNamespace, resource.ListOptions{})
		require.NoError(t, err)
		require.Len(t, routes.Items, 1)
		var importedRoute *v0alpha1.RoutingTree
		for _, r := range routes.Items {
			if r.Name == identifier {
				importedRoute = &r
			}
		}
		require.Nil(t, importedRoute)
	})
}
