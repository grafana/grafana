package correlations

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/utils/ptr"

	correlationsV0 "github.com/grafana/grafana/apps/correlations/pkg/apis/correlation/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationCorrelations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, mode := range []grafanarest.DualWriterMode{
		grafanarest.Mode0, // Only legacy for now
		// grafanarest.Mode2,
		// grafanarest.Mode3,
		// grafanarest.Mode5,
	} {
		t.Run(fmt.Sprintf("correlations (mode:%d)", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableAnonymous:     true,
				EnableFeatureToggles: []string{featuremgmt.FlagKubernetesCorrelations},
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"correlation.correlations.grafana.app": {
						DualWriterMode: mode,
					},
				},
			})
			helper.CreateDS(&datasources.AddDataSourceCommand{
				OrgID: helper.Org1.OrgID,
				Name:  "test-A",
				UID:   "test-A",
				Type:  "testdata",
			})
			helper.CreateDS(&datasources.AddDataSourceCommand{
				OrgID: helper.Org1.OrgID,
				Name:  "test-B",
				UID:   "test-B",
				Type:  "testdata",
			})

			ctx := context.Background()
			kind := correlationsV0.CorrelationKind()
			correlationsClient := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  kind.GroupVersionResource(),
			})

			cmd := &correlations.CreateCorrelationCommand{
				// Loaded from the request, not the payload
				// SourceUID:   "test-A",
				// OrgId:       correlationsClient.Args.User.Identity.GetOrgID(),
				TargetUID:   ptr.To("test-B"),
				Label:       "hello",
				Description: "test test test",
				Type:        correlations.CorrelationType("query"),
				Config: correlations.CorrelationConfig{
					Field:  "a",
					Target: map[string]any{},
					Transformations: correlations.Transformations{{
						Type:       "logfmt",
						Expression: "aaaa",
						Field:      "f0",
						MapValue:   "mapped",
					}},
				},
			}
			body, err := json.Marshal(cmd)
			require.NoError(t, err)

			createAtoB := apis.DoRequest(helper, apis.RequestParams{
				User:   correlationsClient.Args.User,
				Method: http.MethodPost,
				Path:   "/api/datasources/uid/test-A/correlations",
				Body:   body,
			}, &correlations.CreateCorrelationResponseBody{})
			require.Equal(t, http.StatusOK, createAtoB.Response.StatusCode, "create correlation")
			require.NotEmpty(t, createAtoB.Result.Result.UID, "a to b")
			uidAtoB := createAtoB.Result.Result.UID

			// List the value
			listResults, err := correlationsClient.Resource.List(ctx, v1.ListOptions{})
			require.NoError(t, err)
			require.Len(t, listResults.Items, 1)
			require.Equal(t, uidAtoB, listResults.Items[0].GetName())

			// Get the value
			getResults, err := correlationsClient.Resource.Get(ctx, uidAtoB, v1.GetOptions{})
			require.NoError(t, err)
			require.Equal(t, uidAtoB, getResults.GetName())

			// Create via /apis and ensure legacy /api can read it.
			k8sOnly := &unstructured.Unstructured{
				Object: map[string]any{
					"spec": map[string]any{
						"type":  "query",
						"label": "from-k8s",
						"source": map[string]any{
							"group": "testdata",
							"name":  "test-A",
						},
						"target": map[string]any{
							"group": "testdata",
							"name":  "test-B",
						},
						"config": map[string]any{
							"field":  "traceID",
							"target": map[string]any{},
						},
					},
				},
			}
			k8sOnly.SetGenerateName("corr-")
			k8sOnly.SetNamespace(helper.Namespacer(helper.Org1.OrgID))
			k8sOnly.SetAPIVersion(kind.GroupVersionResource().GroupVersion().String())
			k8sOnly.SetKind("Correlation")
			createdK8s, err := correlationsClient.Resource.Create(ctx, k8sOnly, v1.CreateOptions{})
			require.NoError(t, err)
			require.NotEmpty(t, createdK8s.GetName())

			legacyGet := apis.DoRequest(helper, apis.RequestParams{
				User:   correlationsClient.Args.User,
				Method: http.MethodGet,
				Path:   fmt.Sprintf("/api/datasources/uid/test-A/correlations/%s", createdK8s.GetName()),
			}, &map[string]any{})
			require.Equal(t, http.StatusOK, legacyGet.Response.StatusCode, "read /apis-created correlation via legacy /api")
			require.Equal(t, createdK8s.GetName(), (*legacyGet.Result)["uid"])
		})
	}
}
