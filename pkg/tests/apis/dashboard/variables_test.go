package dashboards

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const folderLabelSelectorKey = utils.AnnoKeyFolder

// variableResourceInfos lists every version the Variable kind is served at.
var variableResourceInfos = []utils.ResourceInfo{
	dashv2beta1.VariableResourceInfo,
	dashv2.VariableResourceInfo,
}

func TestIntegrationVariables(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous:     true,
		EnableFeatureToggles: []string{"grafana.dashboardGlobalVariables"},
	})
	t.Cleanup(helper.Shutdown)

	for _, info := range variableResourceInfos {
		t.Run(info.GroupVersion().Version, func(t *testing.T) {
			testVariablesAtVersion(t, helper, info)
		})
	}

	t.Run("across versions", func(t *testing.T) {
		testVariablesAcrossVersions(t, helper)
	})
}

func testVariablesAtVersion(t *testing.T, helper *apis.K8sTestHelper, info utils.ResourceInfo) {
	ctx := context.Background()
	admin := helper.Org1.Admin
	editor := helper.Org1.Editor
	viewer := helper.Org1.Viewer

	variableClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User: admin,
		GVR:  info.GroupVersionResource(),
	})
	editorVariableClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User: editor,
		GVR:  info.GroupVersionResource(),
	})
	viewerVariableClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User: viewer,
		GVR:  info.GroupVersionResource(),
	})
	folderClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User: admin,
		GVR:  foldersV1.FolderResourceInfo.GroupVersionResource(),
	})

	listRsp, err := variableClient.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	require.Empty(t, listRsp.Items)

	t.Run("editor cannot mutate root variables", func(t *testing.T) {
		editorVariable := buildVariableObject(info, "", "editorRegion", "")
		_, err := editorVariableClient.Resource.Create(ctx, editorVariable, metav1.CreateOptions{})
		require.Error(t, err)
		require.True(t, k8serrors.IsForbidden(err), "expected forbidden error, got: %v", err)
	})

	t.Run("viewer cannot mutate variables", func(t *testing.T) {
		viewerVariable := buildVariableObject(info, "viewer-region", "viewerRegion", "")
		_, err := viewerVariableClient.Resource.Create(ctx, viewerVariable, metav1.CreateOptions{})
		require.Error(t, err)
	})

	rootVariable := buildVariableObject(info, "", "region", "")
	createdRootVariable, err := variableClient.Resource.Create(ctx, rootVariable, metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, "region", createdRootVariable.GetName())
	require.Equal(t, info.GroupVersion().String(), createdRootVariable.GetAPIVersion())

	createdRootVariable.Object["spec"].(map[string]any)["spec"].(map[string]any)["query"] = "us-east-1,us-west-2,eu-west-1"
	updatedRootVariable, err := variableClient.Resource.Update(ctx, createdRootVariable, metav1.UpdateOptions{})
	require.NoError(t, err)
	require.Equal(t, "us-east-1,us-west-2,eu-west-1", updatedRootVariable.Object["spec"].(map[string]any)["spec"].(map[string]any)["query"])

	// fixed:variables:reader grants Viewer; BuiltInRolesWithParents also seeds Editor/Admin,
	// so Editors can GET/list stack-wide vars without variablesWriterRole.
	t.Run("editor and viewer can read root variables", func(t *testing.T) {
		got, err := editorVariableClient.Resource.Get(ctx, createdRootVariable.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "region", got.GetName())

		list, err := editorVariableClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.True(t, containsVariableName(list.Items, "region"))

		got, err = viewerVariableClient.Resource.Get(ctx, createdRootVariable.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "region", got.GetName())

		list, err = viewerVariableClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.True(t, containsVariableName(list.Items, "region"))
	})

	folder1 := buildFolderObject(helper.Namespacer(admin.Identity.GetOrgID()), "Folder 1")
	createdFolder1, err := folderClient.Resource.Create(ctx, folder1, metav1.CreateOptions{})
	require.NoError(t, err)

	folder2 := buildFolderObject(helper.Namespacer(admin.Identity.GetOrgID()), "Folder 2")
	createdFolder2, err := folderClient.Resource.Create(ctx, folder2, metav1.CreateOptions{})
	require.NoError(t, err)

	// Default folder ACLs grant Editors Edit, which includes variables:* via FolderEditActions.
	t.Run("editor can mutate variables in folder with edit access", func(t *testing.T) {
		editorFolderVariable := buildVariableObject(info, "", "editorFolderVar", createdFolder1.GetName())
		created, err := editorVariableClient.Resource.Create(ctx, editorFolderVariable, metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, "editorFolderVar--"+createdFolder1.GetName(), created.GetName())

		err = editorVariableClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("editor cannot create variable in folder without edit access", func(t *testing.T) {
		editorID, err := identity.UserIdentifier(editor.Identity.GetID())
		require.NoError(t, err)
		adminID, err := identity.UserIdentifier(admin.Identity.GetID())
		require.NoError(t, err)

		setFolderPermissions(t, helper, admin, createdFolder2.GetName(), []ResourcePermissionSetting{
			{UserID: &adminID, Level: ResourcePermissionLevelAdmin},
			{UserID: &editorID, Level: ResourcePermissionLevelView},
		})

		restrictedFolderVariable := buildVariableObject(info, "", "editorDenied", createdFolder2.GetName())
		_, err = editorVariableClient.Resource.Create(ctx, restrictedFolderVariable, metav1.CreateOptions{})
		require.Error(t, err)
		require.True(t, k8serrors.IsForbidden(err), "expected forbidden error, got: %v", err)
	})

	folderVariable := buildVariableObject(info, "", "region", createdFolder1.GetName())
	createdFolderVariable, err := variableClient.Resource.Create(ctx, folderVariable, metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, "region--"+createdFolder1.GetName(), createdFolderVariable.GetName())
	require.Equal(t, createdFolder1.GetName(), createdFolderVariable.GetAnnotations()[utils.AnnoKeyFolder])

	duplicateVariable := buildVariableObject(info, "", "region", "")
	_, err = variableClient.Resource.Create(ctx, duplicateVariable, metav1.CreateOptions{})
	require.Error(t, err)
	require.True(t, k8serrors.IsAlreadyExists(err), "expected already exists error, got: %v", err)

	duplicateFolderVariable := buildVariableObject(info, "", "region", createdFolder1.GetName())
	_, err = variableClient.Resource.Create(ctx, duplicateFolderVariable, metav1.CreateOptions{})
	require.Error(t, err)
	require.True(t, k8serrors.IsAlreadyExists(err), "expected already exists error, got: %v", err)

	folderVariableInDifferentFolder := buildVariableObject(info, "", "region", createdFolder2.GetName())
	createdFolderVariableInDifferentFolder, err := variableClient.Resource.Create(ctx, folderVariableInDifferentFolder, metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, "region--"+createdFolder2.GetName(), createdFolderVariableInDifferentFolder.GetName())

	serviceVariable := buildVariableObject(info, "", "service", "")
	createdServiceVariable, err := variableClient.Resource.Create(ctx, serviceVariable, metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, "service", createdServiceVariable.GetName())

	t.Run("should allow explicit metadata.name when it matches derived contract", func(t *testing.T) {
		explicit := buildVariableObject(info, "latency--"+createdFolder1.GetName(), "latency", createdFolder1.GetName())
		created, err := variableClient.Resource.Create(ctx, explicit, metav1.CreateOptions{})
		require.NoError(t, err)
		require.Equal(t, "latency--"+createdFolder1.GetName(), created.GetName())
		require.NoError(t, variableClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{}))
	})

	t.Run("should reject explicit metadata.name when it does not match derived contract", func(t *testing.T) {
		mismatch := buildVariableObject(info, "status5", "status", createdFolder1.GetName())
		_, err := variableClient.Resource.Create(ctx, mismatch, metav1.CreateOptions{})
		require.Error(t, err)
		require.True(t, k8serrors.IsBadRequest(err), "expected bad request, got: %v", err)
		require.Contains(t, err.Error(), `expected "status--`+createdFolder1.GetName()+`"`)
	})

	t.Run("should filter by variable spec name", func(t *testing.T) {
		list, err := variableClient.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.spec.name=service",
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, "service", list.Items[0].GetName())
	})

	t.Run("should filter by multiple field selectors", func(t *testing.T) {
		list, err := variableClient.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "metadata.name=service,spec.spec.name=service",
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, "service", list.Items[0].GetName())
	})

	t.Run("should return empty when spec name filter does not match", func(t *testing.T) {
		list, err := variableClient.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.spec.name=does-not-exist",
		})
		require.NoError(t, err)
		require.Empty(t, list.Items)
	})

	t.Run("should filter by folder label and spec name in a single call", func(t *testing.T) {
		list, err := variableClient.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.spec.name=region",
			LabelSelector: folderLabelSelectorKey + "=" + createdFolder1.GetName(),
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, "region--"+createdFolder1.GetName(), list.Items[0].GetName())
	})

	annotations := createdFolderVariable.GetAnnotations()
	annotations[utils.AnnoKeyFolder] = createdFolder2.GetName()
	createdFolderVariable.SetAnnotations(annotations)
	_, err = variableClient.Resource.Update(ctx, createdFolderVariable, metav1.UpdateOptions{})
	require.Error(t, err)
	require.True(t, k8serrors.IsBadRequest(err), "expected bad request, got: %v", err)

	annotations = createdFolderVariable.GetAnnotations()
	annotations[utils.AnnoKeyFolder] = "non-existent-folder"
	createdFolderVariable.SetAnnotations(annotations)
	_, err = variableClient.Resource.Update(ctx, createdFolderVariable, metav1.UpdateOptions{})
	require.Error(t, err)
	require.True(t, k8serrors.IsBadRequest(err), "expected bad request, got: %v", err)

	updatedRootVariable.Object["spec"].(map[string]any)["spec"].(map[string]any)["name"] = "region_renamed"
	_, err = variableClient.Resource.Update(ctx, updatedRootVariable, metav1.UpdateOptions{})
	require.Error(t, err)
	require.True(t, k8serrors.IsBadRequest(err), "expected bad request, got: %v", err)

	invalidFolderVariable := buildVariableObject(info, "", "service", "missing-folder")
	_, err = variableClient.Resource.Create(ctx, invalidFolderVariable, metav1.CreateOptions{})
	require.Error(t, err)

	_, err = viewerVariableClient.Resource.Update(ctx, createdFolderVariable, metav1.UpdateOptions{})
	require.Error(t, err)
	err = viewerVariableClient.Resource.Delete(ctx, createdFolderVariable.GetName(), metav1.DeleteOptions{})
	require.Error(t, err)

	err = variableClient.Resource.Delete(ctx, createdRootVariable.GetName(), metav1.DeleteOptions{})
	require.NoError(t, err)
	err = variableClient.Resource.Delete(ctx, createdFolderVariable.GetName(), metav1.DeleteOptions{})
	require.NoError(t, err)
	err = variableClient.Resource.Delete(ctx, createdFolderVariableInDifferentFolder.GetName(), metav1.DeleteOptions{})
	require.NoError(t, err)
	err = variableClient.Resource.Delete(ctx, createdServiceVariable.GetName(), metav1.DeleteOptions{})
	require.NoError(t, err)
}

// testVariablesAcrossVersions checks that a variable written through one version
// is read, listed, filtered, updated and deleted through the other with the same spec.
func testVariablesAcrossVersions(t *testing.T, helper *apis.K8sTestHelper) {
	ctx := context.Background()
	admin := helper.Org1.Admin
	betaClient := helper.GetResourceClient(apis.ResourceClientArgs{User: admin, GVR: dashv2beta1.VariableResourceInfo.GroupVersionResource()})
	stableClient := helper.GetResourceClient(apis.ResourceClientArgs{User: admin, GVR: dashv2.VariableResourceInfo.GroupVersionResource()})
	folderClient := helper.GetResourceClient(apis.ResourceClientArgs{User: admin, GVR: foldersV1.FolderResourceInfo.GroupVersionResource()})

	folder, err := folderClient.Resource.Create(ctx, buildFolderObject(helper.Namespacer(admin.Identity.GetOrgID()), "Cross-version folder"), metav1.CreateOptions{})
	require.NoError(t, err)

	writtenAsBeta, err := betaClient.Resource.Create(ctx, buildVariableObject(dashv2beta1.VariableResourceInfo, "", "betaWritten", ""), metav1.CreateOptions{})
	require.NoError(t, err)
	writtenAsStable, err := stableClient.Resource.Create(ctx, buildVariableObject(dashv2.VariableResourceInfo, "", "stableWritten", folder.GetName()), metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, "stableWritten--"+folder.GetName(), writtenAsStable.GetName())

	t.Run("get converts to the requested version", func(t *testing.T) {
		got, err := stableClient.Resource.Get(ctx, writtenAsBeta.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, dashv2.APIVERSION, got.GetAPIVersion())
		require.Equal(t, writtenAsBeta.Object["spec"], got.Object["spec"])

		got, err = betaClient.Resource.Get(ctx, writtenAsStable.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, dashv2beta1.APIVERSION, got.GetAPIVersion())
		require.Equal(t, writtenAsStable.Object["spec"], got.Object["spec"])
		require.Equal(t, folder.GetName(), got.GetAnnotations()[utils.AnnoKeyFolder])
	})

	t.Run("list returns every item in the requested version", func(t *testing.T) {
		for _, c := range []struct {
			client  *apis.K8sResourceClient
			version string
		}{{betaClient, dashv2beta1.APIVERSION}, {stableClient, dashv2.APIVERSION}} {
			list, err := c.client.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			require.True(t, containsVariableName(list.Items, writtenAsBeta.GetName()))
			require.True(t, containsVariableName(list.Items, writtenAsStable.GetName()))
			for _, item := range list.Items {
				require.Equal(t, c.version, item.GetAPIVersion(), "item %s has the wrong apiVersion", item.GetName())
			}
		}
	})

	t.Run("selectors match items written in the other version", func(t *testing.T) {
		list, err := stableClient.Resource.List(ctx, metav1.ListOptions{FieldSelector: "spec.spec.name=betaWritten"})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, writtenAsBeta.GetName(), list.Items[0].GetName())

		list, err = betaClient.Resource.List(ctx, metav1.ListOptions{
			FieldSelector: "spec.spec.name=stableWritten",
			LabelSelector: folderLabelSelectorKey + "=" + folder.GetName(),
		})
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, writtenAsStable.GetName(), list.Items[0].GetName())
	})

	t.Run("update through the other version", func(t *testing.T) {
		got, err := stableClient.Resource.Get(ctx, writtenAsBeta.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		got.Object["spec"].(map[string]any)["spec"].(map[string]any)["query"] = "dev,qa"
		_, err = stableClient.Resource.Update(ctx, got, metav1.UpdateOptions{})
		require.NoError(t, err)

		reread, err := betaClient.Resource.Get(ctx, writtenAsBeta.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "dev,qa", reread.Object["spec"].(map[string]any)["spec"].(map[string]any)["query"])

		renamed := reread.DeepCopy()
		renamed.Object["spec"].(map[string]any)["spec"].(map[string]any)["name"] = "betaRenamed"
		renamed.SetAPIVersion(dashv2.APIVERSION)
		_, err = stableClient.Resource.Update(ctx, renamed, metav1.UpdateOptions{})
		require.True(t, k8serrors.IsBadRequest(err), "expected bad request, got: %v", err)
	})

	t.Run("delete through the other version", func(t *testing.T) {
		require.NoError(t, stableClient.Resource.Delete(ctx, writtenAsBeta.GetName(), metav1.DeleteOptions{}))
		require.NoError(t, betaClient.Resource.Delete(ctx, writtenAsStable.GetName(), metav1.DeleteOptions{}))

		_, err := betaClient.Resource.Get(ctx, writtenAsBeta.GetName(), metav1.GetOptions{})
		require.True(t, k8serrors.IsNotFound(err), "expected not found, got: %v", err)
		_, err = stableClient.Resource.Get(ctx, writtenAsStable.GetName(), metav1.GetOptions{})
		require.True(t, k8serrors.IsNotFound(err), "expected not found, got: %v", err)
	})
}

func containsVariableName(items []unstructured.Unstructured, name string) bool {
	for _, item := range items {
		if item.GetName() == name {
			return true
		}
	}
	return false
}

// TestIntegrationVariablesFlagDisabled asserts the flag-off path after
// Variable storage is always registered: enablement is enforced solely by the
// authorizer, so disabled means 403 (not 404).
func TestIntegrationVariablesFlagDisabled(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})
	t.Cleanup(helper.Shutdown)

	ctx := context.Background()
	const denyReason = "global dashboard variables feature is not enabled"

	for _, info := range variableResourceInfos {
		t.Run(info.GroupVersion().Version, func(t *testing.T) {
			variableClient := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  info.GroupVersionResource(),
			})

			_, err := variableClient.Resource.List(ctx, metav1.ListOptions{})
			require.Error(t, err)
			require.True(t, k8serrors.IsForbidden(err), "expected forbidden error, got: %v", err)
			require.Contains(t, err.Error(), denyReason)

			_, err = variableClient.Resource.Create(ctx, buildVariableObject(info, "", "region", ""), metav1.CreateOptions{})
			require.Error(t, err)
			require.True(t, k8serrors.IsForbidden(err), "expected forbidden error, got: %v", err)
			require.Contains(t, err.Error(), denyReason)
		})
	}
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

func buildVariableObject(info utils.ResourceInfo, metadataName string, variableName string, folderUID string) *unstructured.Unstructured {
	annotations := map[string]any{}
	if folderUID != "" {
		annotations[utils.AnnoKeyFolder] = folderUID
	}

	metadata := map[string]any{
		"annotations": annotations,
	}
	if metadataName != "" {
		metadata["name"] = metadataName
	}

	return &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": info.GroupVersion().String(),
			"kind":       info.GroupVersionKind().Kind,
			"metadata":   metadata,
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
