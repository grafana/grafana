package annotations

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"

	annotationV0 "github.com/grafana/grafana/apps/annotation/pkg/apis/annotation/v0alpha1"
	annotationReg "github.com/grafana/grafana/pkg/registry/apps/annotation"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

var gvr = schema.GroupVersionResource{
	Group:    "annotation.grafana.app",
	Version:  "v0alpha1",
	Resource: "annotations",
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func setupTest(t *testing.T) (*apis.K8sTestHelper, *apis.K8sResourceClient) {
	t.Helper()
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:           false,
		DisableAnonymous:            true,
		EnableAnnotationAppPlatform: true,
	})

	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})

	return helper, client
}

func newAnnotation(text string, tags ...string) *unstructured.Unstructured {
	tagSlice := make([]any, len(tags))
	for i, t := range tags {
		tagSlice[i] = t
	}
	return &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "annotation.grafana.app/v0alpha1",
			"kind":       "Annotation",
			"metadata": map[string]any{
				"generateName": "a-",
			},
			"spec": map[string]any{
				"text": text,
				"time": int64(1700000000000),
				"tags": tagSlice,
			},
		},
	}
}

func TestIntegrationAnnotationCreate(t *testing.T) {
	_, client := setupTest(t)
	ctx := t.Context()

	created, err := client.Resource.Create(ctx, newAnnotation("create test", "t1"), metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotEmpty(t, created.GetName())

	text, _, _ := unstructured.NestedString(created.Object, "spec", "text")
	require.Equal(t, "create test", text)

	tags, _, _ := unstructured.NestedStringSlice(created.Object, "spec", "tags")
	require.Equal(t, []string{"t1"}, tags)
}

func TestIntegrationAnnotationGet(t *testing.T) {
	_, client := setupTest(t)
	ctx := t.Context()

	created, err := client.Resource.Create(ctx, newAnnotation("get test"), metav1.CreateOptions{})
	require.NoError(t, err)

	fetched, err := client.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
	require.NoError(t, err)

	text, _, _ := unstructured.NestedString(fetched.Object, "spec", "text")
	require.Equal(t, "get test", text)
}

func TestIntegrationAnnotationList(t *testing.T) {
	_, client := setupTest(t)
	ctx := t.Context()

	_, err := client.Resource.Create(ctx, newAnnotation("one annotation"), metav1.CreateOptions{})
	require.NoError(t, err)
	_, err = client.Resource.Create(ctx, newAnnotation("another annotation"), metav1.CreateOptions{})
	require.NoError(t, err)

	list, err := client.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.GreaterOrEqual(t, len(list.Items), 2)
}

func TestIntegrationAnnotationUpdate(t *testing.T) {
	_, client := setupTest(t)
	ctx := t.Context()

	created, err := client.Resource.Create(ctx, newAnnotation("before update", "old"), metav1.CreateOptions{})
	require.NoError(t, err)

	created.Object["spec"].(map[string]any)["text"] = "after update"
	created.Object["spec"].(map[string]any)["tags"] = []any{"new"}

	updated, err := client.Resource.Update(ctx, created, metav1.UpdateOptions{})
	require.NoError(t, err)

	text, _, _ := unstructured.NestedString(updated.Object, "spec", "text")
	require.Equal(t, "after update", text)

	tags, _, _ := unstructured.NestedStringSlice(updated.Object, "spec", "tags")
	require.Equal(t, []string{"new"}, tags)

	fetched, err := client.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
	require.NoError(t, err)
	text, _, _ = unstructured.NestedString(fetched.Object, "spec", "text")
	require.Equal(t, "after update", text)
}

func TestIntegrationAnnotationPatch(t *testing.T) {
	_, client := setupTest(t)
	ctx := t.Context()

	created, err := client.Resource.Create(ctx, newAnnotation("original text", "tag1", "tag2"), metav1.CreateOptions{})
	require.NoError(t, err)

	patched, err := client.Resource.Patch(ctx, created.GetName(), types.MergePatchType, []byte(`{
		"spec": {
			"text": "patched text",
			"tags": ["patched"]
		}
	}`), metav1.PatchOptions{})
	require.NoError(t, err)

	patchedText, _, _ := unstructured.NestedString(patched.Object, "spec", "text")
	require.Equal(t, "patched text", patchedText)

	patchedTags, _, _ := unstructured.NestedStringSlice(patched.Object, "spec", "tags")
	require.Equal(t, []string{"patched"}, patchedTags)

	fetched, err := client.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
	require.NoError(t, err)
	text, _, _ := unstructured.NestedString(fetched.Object, "spec", "text")
	require.Equal(t, "patched text", text)
}

func TestIntegrationAnnotationDelete(t *testing.T) {
	_, client := setupTest(t)
	ctx := t.Context()

	created, err := client.Resource.Create(ctx, newAnnotation("delete me"), metav1.CreateOptions{})
	require.NoError(t, err)

	err = client.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
	require.NoError(t, err)

	_, err = client.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
	require.Error(t, err)
}

func TestIntegrationAnnotationSearch(t *testing.T) {
	helper, client := setupTest(t)
	ctx := t.Context()

	// Create two annotations with different tags
	_, err := client.Resource.Create(ctx, newAnnotation("first", "search-a"), metav1.CreateOptions{})
	require.NoError(t, err)
	_, err = client.Resource.Create(ctx, newAnnotation("second", "search-b"), metav1.CreateOptions{})
	require.NoError(t, err)

	namespace := helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID())
	basePath := fmt.Sprintf("/apis/annotation.grafana.app/v0alpha1/namespaces/%s/search", namespace)

	// Search without filters should return both
	rsp := apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin,
		Path: basePath,
	}, &annotationV0.AnnotationList{})
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
	require.GreaterOrEqual(t, len(rsp.Result.Items), 2)

	// Search filtered by tag should narrow results
	rsp = apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin,
		Path: basePath + "?tag=search-a",
	}, &annotationV0.AnnotationList{})
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
	require.GreaterOrEqual(t, len(rsp.Result.Items), 1)
	for _, item := range rsp.Result.Items {
		require.Contains(t, item.Spec.Tags, "search-a")
	}
}

func TestIntegrationAnnotationTags(t *testing.T) {
	helper, client := setupTest(t)
	ctx := t.Context()

	// Create annotations with distinct tag prefixes
	_, err := client.Resource.Create(ctx, newAnnotation("for tags", "env:prod"), metav1.CreateOptions{})
	require.NoError(t, err)
	_, err = client.Resource.Create(ctx, newAnnotation("for tags 2", "env:prod"), metav1.CreateOptions{})
	require.NoError(t, err)
	_, err = client.Resource.Create(ctx, newAnnotation("for tags 3", "region:us"), metav1.CreateOptions{})
	require.NoError(t, err)

	namespace := helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID())
	basePath := fmt.Sprintf("/apis/annotation.grafana.app/v0alpha1/namespaces/%s/tags", namespace)

	// Fetch all tags
	rsp := apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin,
		Path: basePath,
	}, &annotationReg.TagResponse{})
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
	require.GreaterOrEqual(t, len(rsp.Result.Tags), 2)

	// Find our known tag and verify count
	var found bool
	for _, tag := range rsp.Result.Tags {
		if tag.Tag == "env:prod" {
			require.GreaterOrEqual(t, tag.Count, int64(2))
			found = true
		}
	}
	require.True(t, found, "expected to find tag env:prod")

	// Filter by prefix should only return matching tags
	rsp = apis.DoRequest(helper, apis.RequestParams{
		User: helper.Org1.Admin,
		Path: basePath + "?prefix=env",
	}, &annotationReg.TagResponse{})
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
	require.GreaterOrEqual(t, len(rsp.Result.Tags), 1)
	for _, tag := range rsp.Result.Tags {
		require.Contains(t, tag.Tag, "env")
	}
}
