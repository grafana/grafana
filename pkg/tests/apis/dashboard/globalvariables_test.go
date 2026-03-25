package dashboards

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const folderLabelSelectorKey = "dashboard.grafana.app/folder"

func TestIntegrationGlobalVariablesV2beta1(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous:      true,
		DisableDataMigrations: true,
		EnableFeatureToggles:  []string{"globalDashboardVariables"},
	})
	t.Cleanup(helper.Shutdown)

	ctx := context.Background()
	admin := helper.Org1.Admin

	globalVariableClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User: admin,
		GVR:  dashv2beta1.GlobalVariableResourceInfo.GroupVersionResource(),
	})
	folderClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User: admin,
		GVR:  foldersV1.FolderResourceInfo.GroupVersionResource(),
	})

	listRsp, err := globalVariableClient.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Empty(t, listRsp.Items)

	rootVariable := buildGlobalVariableObject("global-region", "region", "")
	createdRootVariable, err := globalVariableClient.Resource.Create(ctx, rootVariable, metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, "global-region", createdRootVariable.GetName())

	createdRootVariable.Object["spec"].(map[string]any)["spec"].(map[string]any)["query"] = "us-east-1,us-west-2,eu-west-1"
	updatedRootVariable, err := globalVariableClient.Resource.Update(ctx, createdRootVariable, metav1.UpdateOptions{})
	require.NoError(t, err)
	require.Equal(t, "us-east-1,us-west-2,eu-west-1", updatedRootVariable.Object["spec"].(map[string]any)["spec"].(map[string]any)["query"])

	folder1 := buildFolderObject(helper.Namespacer(admin.Identity.GetOrgID()), "Folder 1")
	createdFolder1, err := folderClient.Resource.Create(ctx, folder1, metav1.CreateOptions{})
	require.NoError(t, err)

	folder2 := buildFolderObject(helper.Namespacer(admin.Identity.GetOrgID()), "Folder 2")
	createdFolder2, err := folderClient.Resource.Create(ctx, folder2, metav1.CreateOptions{})
	require.NoError(t, err)

	folderVariable := buildGlobalVariableObject("folder-region", "region", createdFolder1.GetName())
	createdFolderVariable, err := globalVariableClient.Resource.Create(ctx, folderVariable, metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, "folder-region", createdFolderVariable.GetName())
	require.Equal(t, createdFolder1.GetName(), createdFolderVariable.GetAnnotations()[utils.AnnoKeyFolder])

	duplicateGlobalVariable := buildGlobalVariableObject("global-region-duplicate", "region", "")
	_, err = globalVariableClient.Resource.Create(ctx, duplicateGlobalVariable, metav1.CreateOptions{})
	require.Error(t, err)

	duplicateFolderVariable := buildGlobalVariableObject("folder-region-duplicate", "region", createdFolder1.GetName())
	_, err = globalVariableClient.Resource.Create(ctx, duplicateFolderVariable, metav1.CreateOptions{})
	require.Error(t, err)

	folderVariableInDifferentFolder := buildGlobalVariableObject("folder-region-folder2", "region", createdFolder2.GetName())
	createdFolderVariableInDifferentFolder, err := globalVariableClient.Resource.Create(ctx, folderVariableInDifferentFolder, metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, "folder-region-folder2", createdFolderVariableInDifferentFolder.GetName())

	serviceVariable := buildGlobalVariableObject("global-service", "service", "")
	createdServiceVariable, err := globalVariableClient.Resource.Create(ctx, serviceVariable, metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, "global-service", createdServiceVariable.GetName())

	t.Run("should filter by global variable spec name", func(t *testing.T) {
		list, err := globalVariableClient.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.spec.name=service",
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, "global-service", list.Items[0].GetName())
	})

	t.Run("should filter by multiple field selectors", func(t *testing.T) {
		list, err := globalVariableClient.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "metadata.name=global-service,spec.spec.name=service",
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, "global-service", list.Items[0].GetName())
	})

	t.Run("should return empty when spec name filter does not match", func(t *testing.T) {
		list, err := globalVariableClient.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.spec.name=does-not-exist",
		})
		require.NoError(t, err)
		require.Empty(t, list.Items)
	})

	t.Run("should filter by folder label and spec name in a single call", func(t *testing.T) {
		list, err := globalVariableClient.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.spec.name=region",
			LabelSelector: folderLabelSelectorKey + "=" + createdFolder1.GetName(),
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, "folder-region", list.Items[0].GetName())
	})

	annotations := createdFolderVariable.GetAnnotations()
	annotations[utils.AnnoKeyFolder] = createdFolder2.GetName()
	createdFolderVariable.SetAnnotations(annotations)
	_, err = globalVariableClient.Resource.Update(ctx, createdFolderVariable, metav1.UpdateOptions{})
	require.Error(t, err)

	err = globalVariableClient.Resource.Delete(ctx, createdFolderVariableInDifferentFolder.GetName(), metav1.DeleteOptions{})
	require.NoError(t, err)

	movedFolderVariable, err := globalVariableClient.Resource.Update(ctx, createdFolderVariable, metav1.UpdateOptions{})
	require.NoError(t, err)
	require.Equal(t, createdFolder2.GetName(), movedFolderVariable.GetAnnotations()[utils.AnnoKeyFolder])

	t.Run("should reflect folder move in label selector results", func(t *testing.T) {
		oldFolderList, err := globalVariableClient.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.spec.name=region",
			LabelSelector: folderLabelSelectorKey + "=" + createdFolder1.GetName(),
		})
		require.NoError(t, err)
		require.Empty(t, oldFolderList.Items)

		newFolderList, err := globalVariableClient.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.spec.name=region",
			LabelSelector: folderLabelSelectorKey + "=" + createdFolder2.GetName(),
		})
		require.NoError(t, err)
		require.Len(t, newFolderList.Items, 1)
		require.Equal(t, "folder-region", newFolderList.Items[0].GetName())
	})

	annotations = movedFolderVariable.GetAnnotations()
	annotations[utils.AnnoKeyFolder] = "non-existent-folder"
	movedFolderVariable.SetAnnotations(annotations)
	_, err = globalVariableClient.Resource.Update(ctx, movedFolderVariable, metav1.UpdateOptions{})
	require.Error(t, err)

	invalidFolderVariable := buildGlobalVariableObject("service-missing-folder", "service", "missing-folder")
	_, err = globalVariableClient.Resource.Create(ctx, invalidFolderVariable, metav1.CreateOptions{})
	require.Error(t, err)

	err = globalVariableClient.Resource.Delete(ctx, "global-region", metav1.DeleteOptions{})
	require.NoError(t, err)
	err = globalVariableClient.Resource.Delete(ctx, "folder-region", metav1.DeleteOptions{})
	require.NoError(t, err)
	err = globalVariableClient.Resource.Delete(ctx, "global-service", metav1.DeleteOptions{})
	require.NoError(t, err)
}

func buildFolderObject(namespace string, title string) *unstructured.Unstructured {
	return &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
			"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
			"metadata": map[string]any{
				"generateName": "global-var-folder-",
				"namespace":    namespace,
			},
			"spec": map[string]any{
				"title": title,
			},
		},
	}
}

func buildGlobalVariableObject(metadataName string, variableName string, folderUID string) *unstructured.Unstructured {
	annotations := map[string]any{}
	if folderUID != "" {
		annotations[utils.AnnoKeyFolder] = folderUID
	}

	return &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": dashv2beta1.GlobalVariableResourceInfo.GroupVersion().String(),
			"kind":       dashv2beta1.GlobalVariableResourceInfo.GroupVersionKind().Kind,
			"metadata": map[string]any{
				"name":        metadataName,
				"annotations": annotations,
			},
			"spec": map[string]any{
				"kind": "CustomVariable",
				"spec": map[string]any{
					"name":             variableName,
					"query":            "prod,staging",
					"current":          map[string]any{"text": "prod", "value": "prod"},
					"options":          []any{},
					"multi":            false,
					"includeAll":       false,
					"hide":             "dontHide",
					"skipUrlSync":      false,
					"allowCustomValue": true,
				},
			},
		},
	}
}
