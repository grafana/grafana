package annotations

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
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

func TestIntegrationAnnotations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	for _, mode := range []grafanarest.DualWriterMode{
		grafanarest.Mode0, // Only legacy for now
	} {
		t.Run(fmt.Sprintf("annotations (mode:%d)", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableAnonymous:     true,
				EnableFeatureToggles: []string{featuremgmt.FlagKubernetesAnnotations},
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"annotation.annotation.grafana.app": {
						DualWriterMode: mode,
					},
				},
			})

			ctx := context.Background()
			kind := annotationV0.AnnotationKind()
			annotationsClient := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  kind.GroupVersionResource(),
			})
			namespace := helper.Namespacer(helper.Org1.OrgID)

			legacyCreateBody, err := json.Marshal(map[string]any{
				"text": "from-legacy",
				"time": int64(1700000000000),
				"tags": []string{"legacy-tag"},
			})
			require.NoError(t, err)

			legacyCreate := apis.DoRequest(helper, apis.RequestParams{
				User:   annotationsClient.Args.User,
				Method: http.MethodPost,
				Path:   "/api/annotations",
				Body:   legacyCreateBody,
			}, &map[string]any{})
			require.Equal(t, http.StatusOK, legacyCreate.Response.StatusCode, "create annotation via legacy /api")

			legacyIDRaw, ok := (*legacyCreate.Result)["id"].(float64)
			require.True(t, ok, "legacy response should contain numeric id")
			legacyName := fmt.Sprintf("a-%d", int64(legacyIDRaw))

			listResults, err := annotationsClient.Resource.List(ctx, v1.ListOptions{})
			require.NoError(t, err)
			require.NotEmpty(t, listResults.Items)

			foundLegacy := false
			for _, item := range listResults.Items {
				if item.GetName() == legacyName {
					foundLegacy = true
					break
				}
			}
			require.True(t, foundLegacy, "legacy-created annotation should be visible via /apis")

			k8sAnnotation := &unstructured.Unstructured{
				Object: map[string]any{
					"spec": map[string]any{
						"text":    "from-k8s",
						"time":    int64(1700000001000),
						"panelID": int64(7),
						"tags":    []string{"k8s-tag"},
					},
				},
			}
			k8sAnnotation.SetGenerateName("anno-")
			k8sAnnotation.SetNamespace(namespace)
			k8sAnnotation.SetAPIVersion(kind.GroupVersionResource().GroupVersion().String())
			k8sAnnotation.SetKind("Annotation")

			createdK8s, err := annotationsClient.Resource.Create(ctx, k8sAnnotation, v1.CreateOptions{})
			require.NoError(t, err)
			require.True(t, strings.HasPrefix(createdK8s.GetName(), "a-"), "created annotation name should use legacy ID format")

			k8sID := strings.TrimPrefix(createdK8s.GetName(), "a-")
			_, err = strconv.ParseInt(k8sID, 10, 64)
			require.NoError(t, err)

			legacyGet := apis.DoRequest(helper, apis.RequestParams{
				User:   annotationsClient.Args.User,
				Method: http.MethodGet,
				Path:   fmt.Sprintf("/api/annotations/%s", k8sID),
			}, &map[string]any{})
			require.Equal(t, http.StatusOK, legacyGet.Response.StatusCode, "read /apis-created annotation via legacy /api")
			require.Equal(t, "from-k8s", (*legacyGet.Result)["text"])

			tagsRsp := apis.DoRequest(helper, apis.RequestParams{
				User:   annotationsClient.Args.User,
				Method: http.MethodGet,
				Path:   fmt.Sprintf("/apis/%s/%s/namespaces/%s/tags", annotationV0.APIGroup, annotationV0.APIVersion, namespace),
			}, &map[string]any{})
			require.Equal(t, http.StatusOK, tagsRsp.Response.StatusCode, "read custom tags route via /apis")

			tags, ok := (*tagsRsp.Result)["tags"].([]any)
			require.True(t, ok, "custom tags response should include tags array")

			foundK8sTag := false
			for _, raw := range tags {
				tagItem, ok := raw.(map[string]any)
				if !ok {
					continue
				}
				if tagName, ok := tagItem["tag"].(string); ok && tagName == "k8s-tag" {
					foundK8sTag = true
					break
				}
			}
			require.True(t, foundK8sTag, "tag from /apis-created annotation should be returned by /apis tags route")
		})
	}
}
