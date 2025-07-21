package folder

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/api/dtos"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

var gvr = schema.GroupVersionResource{
	Group:    folders.GROUP,
	Version:  folders.VERSION,
	Resource: "folders",
}

func TestIntegrationFoldersApp(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagKubernetesClientDashboardsFolders,
		},
	})

	t.Run("Check discovery client", func(t *testing.T) {
		disco := helper.NewDiscoveryClient()
		resources, err := disco.ServerResourcesForGroupVersion("folder.grafana.app/v1beta1")
		require.NoError(t, err)

		v1Disco, err := json.MarshalIndent(resources, "", "  ")
		require.NoError(t, err)

		require.JSONEq(t, `{
			"kind": "APIResourceList",
			"apiVersion": "v1",
			"groupVersion": "folder.grafana.app/v1beta1",
			"resources": [
				{
					"name": "folders",
					"singularName": "folder",
					"namespaced": true,
					"kind": "Folder",
					"verbs": [
						"create",
						"delete",
						"deletecollection",
						"get",
						"list",
						"patch",
						"update"
					]
				},
				{
					"name": "folders/access",
					"singularName": "",
					"namespaced": true,
					"kind": "FolderAccessInfo",
					"verbs": [
						"get"
					]
				},
				{
					"name": "folders/children",
					"singularName": "",
					"namespaced": true,
					"kind": "FolderList",
					"verbs": [
						"get"
					]
				},
				{
					"name": "folders/counts",
					"singularName": "",
					"namespaced": true,
					"kind": "DescendantCounts",
					"verbs": [
						"get"
					]
				},
				{
					"name": "folders/parents",
					"singularName": "",
					"namespaced": true,
					"kind": "FolderInfoList",
					"verbs": [
						"get"
					]
				}
			]
		}`, string(v1Disco))
	})

	// test on all dualwriter modes
	for mode := 0; mode <= 4; mode++ {
		modeDw := grafanarest.DualWriterMode(mode)

		t.Run(fmt.Sprintf("with dual write (unified storage, mode %v)", modeDw), func(t *testing.T) {
			doFolderTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    true,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagKubernetesClientDashboardsFolders,
				},
			}))
		})

		t.Run(fmt.Sprintf("with dual write (unified storage, mode %v, create nested folders)", modeDw), func(t *testing.T) {
			doNestedCreateTest(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    true,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagKubernetesClientDashboardsFolders,
					featuremgmt.FlagNestedFolders,
				},
			}))
		})

		t.Run(fmt.Sprintf("with dual write (unified storage, mode %v, create existing folder)", modeDw), func(t *testing.T) {
			doCreateDuplicateFolderTest(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    true,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagKubernetesClientDashboardsFolders,
					featuremgmt.FlagNestedFolders,
				},
			}))
		})

		t.Run(fmt.Sprintf("when creating a folder, mode %v, it should trim leading and trailing spaces", modeDw), func(t *testing.T) {
			doCreateEnsureTitleIsTrimmedTest(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    true,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagKubernetesClientDashboardsFolders,
					featuremgmt.FlagNestedFolders,
				},
			}))
		})

		t.Run(fmt.Sprintf("with dual write (unified storage, mode %v, create circular reference folder)", modeDw), func(t *testing.T) {
			doCreateCircularReferenceFolderTest(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    true,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagKubernetesClientDashboardsFolders,
					featuremgmt.FlagNestedFolders,
				},
			}))
		})
	}

	// This is a general test for the unified storage list operation. We don't have a common test
	// directory for now, so we (search and storage) keep it here as we own this part of the tests.
	t.Run("make sure list works with continue tokens", func(t *testing.T) {
		modes := []grafanarest.DualWriterMode{
			grafanarest.Mode1,
			grafanarest.Mode2,
			grafanarest.Mode3,
			grafanarest.Mode4,
			grafanarest.Mode5,
		}
		for _, mode := range modes {
			t.Run(fmt.Sprintf("mode %d", mode), func(t *testing.T) {
				doListFoldersTest(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
					AppModeProduction:    true,
					DisableAnonymous:     true,
					APIServerStorageType: "unified",
					UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
						folders.RESOURCEGROUP: {
							DualWriterMode: mode,
						},
					},
					// We set it to 1 here, so we always get forced pagination based on the response size.
					UnifiedStorageMaxPageSizeBytes: 1,
					EnableFeatureToggles: []string{
						featuremgmt.FlagKubernetesClientDashboardsFolders,
						featuremgmt.FlagNestedFolders,
					},
				}), mode)
			})
		}
	})
}

func doFolderTests(t *testing.T, helper *apis.K8sTestHelper) *apis.K8sTestHelper {
	t.Run("Check folder CRUD (just create for now) in legacy API appears in k8s apis", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			// #TODO: figure out permissions topic
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		// #TODO fill out the payload: parentUID, description
		// and check about uid orgid and siU
		legacyPayload := `{
			"title": "Test",
			"uid": ""
			}`
		legacyCreate := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/api/folders",
			Body:   []byte(legacyPayload),
		}, &folder.Folder{})
		require.NotNil(t, legacyCreate.Result)
		uid := legacyCreate.Result.UID
		require.NotEmpty(t, uid)
		//nolint:staticcheck
		id := legacyCreate.Result.ID
		require.NotEmpty(t, id)
		idStr := fmt.Sprintf("%d", id)

		expectedResult := `{
			"apiVersion": "folder.grafana.app/v1beta1",
			"kind": "Folder",
			"metadata": {
			  "creationTimestamp": "${creationTimestamp}",
			  "labels": {"grafana.app/deprecatedInternalID":"` + idStr + `"},
			  "name": "` + uid + `",
			  "namespace": "default",
			  "resourceVersion": "${resourceVersion}",
			  "uid": "${uid}"
			},
			"spec": {
			  "title": "Test",
			  "description": ""
			},
			"status": {}
		  }`

		// Get should return the same result
		found, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		require.JSONEq(t, expectedResult, client.SanitizeJSON(found))
	})

	t.Run("Do CRUD (just CR+List for now) via k8s (and check that legacy api still works)", func(t *testing.T) {
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			// #TODO: figure out permissions topic
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		// Create the folder "test"
		first, err := client.Resource.Create(context.Background(),
			helper.LoadYAMLOrJSONFile("testdata/folder-test-create.yaml"),
			metav1.CreateOptions{},
		)
		require.NoError(t, err)
		require.Equal(t, "test", first.GetName())
		uids := []string{first.GetName()}

		// Create (with name generation) two folders
		for i := 0; i < 2; i++ {
			out, err := client.Resource.Create(context.Background(),
				helper.LoadYAMLOrJSONFile("testdata/folder-generate.yaml"),
				metav1.CreateOptions{},
			)
			require.NoError(t, err)
			uids = append(uids, out.GetName())
		}
		slices.Sort(uids) // make list compare stable

		// Check all folders
		for _, uid := range uids {
			getFromBothAPIs(t, helper, client, uid, nil)
		}

		// PUT :: Update the title
		updated, err := client.Resource.Update(context.Background(),
			helper.LoadYAMLOrJSONFile("testdata/folder-test-replace.yaml"),
			metav1.UpdateOptions{},
		)
		require.NoError(t, err)
		spec, ok := updated.Object["spec"].(map[string]any)
		require.True(t, ok)
		title, ok := spec["title"].(string)
		require.True(t, ok)
		description, ok := spec["description"].(string)
		require.True(t, ok)
		require.Equal(t, first.GetName(), updated.GetName())
		require.Equal(t, first.GetUID(), updated.GetUID())
		require.Equal(t, "Test folder (replaced from k8s; 1 item; PUT)", title)
		require.Equal(t, "New description", description)

		// #TODO figure out why this breaks just for MySQL integration tests
		// require.Less(t, first.GetResourceVersion(), updated.GetResourceVersion())

		// ensure that we get 4 items when listing via k8s
		l, err := client.Resource.List(context.Background(), metav1.ListOptions{})
		require.NoError(t, err)
		folders, err := meta.ExtractList(l)
		require.NoError(t, err)
		require.NotNil(t, folders)
		require.Equal(t, len(folders), 4)

		// delete test
		errDelete := client.Resource.Delete(context.Background(), first.GetName(), metav1.DeleteOptions{})
		require.NoError(t, errDelete)
	})
	return helper
}

// This does a get with both k8s and legacy API, and verifies the results are the same
func getFromBothAPIs(t *testing.T,
	helper *apis.K8sTestHelper,
	client *apis.K8sResourceClient,
	uid string,
	// Optionally match some expect some values
	expect *folder.Folder,
) *unstructured.Unstructured {
	t.Helper()

	found, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, uid, found.GetName())

	dto := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodGet,
		Path:   "/api/folders/" + uid,
	}, &folder.Folder{}).Result
	require.NotNil(t, dto)
	require.Equal(t, uid, dto.UID)

	spec, ok := found.Object["spec"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, dto.UID, found.GetName())
	require.Equal(t, dto.Title, spec["title"])
	// #TODO add checks for other fields

	if expect != nil {
		if expect.Title != "" {
			require.Equal(t, expect.Title, dto.Title)
			require.Equal(t, expect.Title, spec["title"])
		}
		if expect.UID != "" {
			require.Equal(t, expect.UID, dto.UID)
			require.Equal(t, expect.UID, found.GetName())
		}
	}
	return found
}

func doNestedCreateTest(t *testing.T, helper *apis.K8sTestHelper) {
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})

	parentPayload := `{
		"title": "Test/parent",
		"uid": ""
		}`
	parentCreate := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodPost,
		Path:   "/api/folders",
		Body:   []byte(parentPayload),
	}, &folder.Folder{})
	require.NotNil(t, parentCreate.Result)
	// creating a folder without providing a parent should default to the empty parent folder
	require.Empty(t, parentCreate.Result.ParentUID)

	parentUID := parentCreate.Result.UID
	require.NotEmpty(t, parentUID)

	childPayload := fmt.Sprintf(`{
			"title": "Test/child",
			"uid": "",
			"parentUid": "%s"
			}`, parentUID)
	childCreate := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodPost,
		Path:   "/api/folders",
		Body:   []byte(childPayload),
	}, &dtos.Folder{})
	require.NotNil(t, childCreate.Result)
	childUID := childCreate.Result.UID
	require.NotEmpty(t, childUID)
	require.Equal(t, "Test/child", childCreate.Result.Title)
	require.Equal(t, 1, len(childCreate.Result.Parents))

	parent := childCreate.Result.Parents[0]
	// creating a folder with a known parent should succeed
	require.Equal(t, parentUID, childCreate.Result.ParentUID)
	require.Equal(t, parentUID, parent.UID)
	require.Equal(t, "Test/parent", parent.Title)
	require.Equal(t, parentCreate.Result.URL, parent.URL)
}

func doCreateDuplicateFolderTest(t *testing.T, helper *apis.K8sTestHelper) {
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})

	payload := `{
		"title": "Test",
		"uid": ""
		}`
	create := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodPost,
		Path:   "/api/folders",
		Body:   []byte(payload),
	}, &folder.Folder{})
	require.NotNil(t, create.Result)
	parentUID := create.Result.UID
	require.NotEmpty(t, parentUID)

	create2 := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodPost,
		Path:   "/api/folders",
		Body:   []byte(payload),
	}, &folder.Folder{})
	require.NotEmpty(t, create2.Response)
	require.Equal(t, 200, create2.Response.StatusCode) // it is OK
}

func doCreateEnsureTitleIsTrimmedTest(t *testing.T, helper *apis.K8sTestHelper) {
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})

	payload := `{
		"title": "  my folder  ",
		"uid": ""
		}`

	// When creating a folder it should trim leading and trailing spaces in both dashboard and folder tables
	create := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodPost,
		Path:   "/api/folders",
		Body:   []byte(payload),
	}, &folder.Folder{})
	require.NotNil(t, create.Result)
	require.Equal(t, "my folder", create.Result.Title)
}

func doCreateCircularReferenceFolderTest(t *testing.T, helper *apis.K8sTestHelper) {
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})

	payload := `{
		"title": "Test",
		"uid": "newFolder",
		"parentUid: "newFolder",
		}`
	create := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodPost,
		Path:   "/api/folders",
		Body:   []byte(payload),
	}, &folder.Folder{})
	require.NotEmpty(t, create.Response)
	require.Equal(t, 400, create.Response.StatusCode)
}

func doListFoldersTest(t *testing.T, helper *apis.K8sTestHelper, mode grafanarest.DualWriterMode) {
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})
	foldersCount := 3
	for i := 0; i < foldersCount; i++ {
		payload, err := json.Marshal(map[string]interface{}{
			"title": fmt.Sprintf("Test-%d", i),
			"uid":   fmt.Sprintf("uid-%d", i),
		})
		require.NoError(t, err)
		parentCreate := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/api/folders",
			Body:   payload,
		}, &folder.Folder{})
		require.NotNil(t, parentCreate.Result)
		require.Equal(t, http.StatusOK, parentCreate.Response.StatusCode)
	}
	fetchedFolders, fetchItemsPerCall := checkListRequest(t, 1, client)
	require.Equal(t, []string{"uid-0", "uid-1", "uid-2"}, fetchedFolders)
	require.Equal(t, []int{1, 1, 1}, fetchItemsPerCall[:3])

	// Now let's see if the iterator also works when we are limited by the page size, which should be set
	// to 1 byte for this test. We only need to check that if we test unified storage as the primary storage,
	// as legacy doesn't have such a page size limit.
	if mode == grafanarest.Mode3 || mode == grafanarest.Mode4 || mode == grafanarest.Mode5 {
		t.Run("check page size iterator", func(t *testing.T) {
			fetchedFolders, fetchItemsPerCall := checkListRequest(t, 3, client)
			require.Equal(t, []string{"uid-0", "uid-1", "uid-2"}, fetchedFolders)
			require.Equal(t, []int{1, 1, 1}, fetchItemsPerCall[:3])
		})
	}
}

func checkListRequest(t *testing.T, limit int64, client *apis.K8sResourceClient) ([]string, []int) {
	fetchedFolders := make([]string, 0, 3)
	fetchItemsPerCall := make([]int, 0, 3)
	continueToken := ""
	for {
		res, err := client.Resource.List(context.Background(), metav1.ListOptions{
			Limit:    limit,
			Continue: continueToken,
		})
		require.NoError(t, err)
		fetchItemsPerCall = append(fetchItemsPerCall, len(res.Items))
		for _, item := range res.Items {
			fetchedFolders = append(fetchedFolders, item.GetName())
		}
		continueToken = res.GetContinue()
		if continueToken == "" {
			break
		}
	}
	return fetchedFolders, fetchItemsPerCall
}

func TestIntegrationFolderCreatePermissions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	folderWithoutParentInput := "{ \"uid\": \"uid\", \"title\": \"Folder\"}"
	folderWithParentInput := "{ \"uid\": \"uid\", \"title\": \"Folder\", \"parentUid\": \"parentuid\"}"

	type testCase struct {
		description  string
		input        string
		permissions  []resourcepermissions.SetResourcePermissionCommand
		expectedCode int
	}
	tcs := []testCase{
		{
			description:  "creation of folder without parent succeeds given the correct request for creating a folder",
			input:        folderWithoutParentInput,
			expectedCode: http.StatusOK,
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{
					Actions:           []string{"folders:create"},
					Resource:          "folders",
					ResourceAttribute: "uid",
					ResourceID:        "*",
				},
			},
		},
		{
			description:  "Should not be able to create a folder under the root with subfolder creation permissions",
			input:        folderWithoutParentInput,
			expectedCode: http.StatusForbidden,
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{
					Actions:           []string{"folders:create"},
					Resource:          "folders",
					ResourceAttribute: "uid",
					ResourceID:        "subfolder_uid",
				},
			},
		},
		{
			description:  "Should not be able to create new folder under another folder without the right permissions",
			input:        folderWithParentInput,
			expectedCode: http.StatusForbidden,
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{
					Actions:           []string{"folders:create"},
					Resource:          "folders",
					ResourceAttribute: "uid",
					ResourceID:        "wrong_uid",
				},
			},
		},
		{
			description:  "creation of folder without parent fails without permissions to create a folder",
			input:        folderWithoutParentInput,
			expectedCode: http.StatusForbidden,
			permissions:  []resourcepermissions.SetResourcePermissionCommand{},
		},
		{
			description:  "creation of folder with parent succeeds given the correct request for creating a folder",
			input:        folderWithParentInput,
			expectedCode: http.StatusOK,
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{
					Actions:           []string{"folders:create"},
					Resource:          "folders",
					ResourceAttribute: "uid",
					ResourceID:        "parentuid",
				},
			},
		},
	}

	// test on all dualwriter modes
	for mode := 0; mode <= 4; mode++ {
		for _, tc := range tcs {
			t.Run(fmt.Sprintf("[Mode: %v] "+tc.description, mode), func(t *testing.T) {
				modeDw := grafanarest.DualWriterMode(mode)
				helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
					AppModeProduction:    true,
					DisableAnonymous:     true,
					APIServerStorageType: "unified",
					UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
						folders.RESOURCEGROUP: {
							DualWriterMode: modeDw,
						},
					},
					EnableFeatureToggles: []string{
						featuremgmt.FlagNestedFolders,
						featuremgmt.FlagKubernetesClientDashboardsFolders,
					},
				})

				user := helper.CreateUser("user", apis.Org1, org.RoleViewer, tc.permissions)

				parentPayload := `{
				"title": "Test/parent",
				"uid": "parentuid"
				}`
				parentCreate := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: http.MethodPost,
					Path:   "/api/folders",
					Body:   []byte(parentPayload),
				}, &folder.Folder{})
				require.NotNil(t, parentCreate.Result)
				parentUID := parentCreate.Result.UID
				require.NotEmpty(t, parentUID)

				resp := apis.DoRequest(helper, apis.RequestParams{
					User:   user,
					Method: http.MethodPost,
					Path:   "/api/folders",
					Body:   []byte(tc.input),
				}, &dtos.Folder{})
				require.Equal(t, tc.expectedCode, resp.Response.StatusCode)

				if tc.expectedCode == http.StatusOK {
					require.Equal(t, "uid", resp.Result.UID)
					require.Equal(t, "Folder", resp.Result.Title)
				}
			})
		}
	}
}

func TestIntegrationFolderGetPermissions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	type testCase struct {
		description          string
		permissions          []resourcepermissions.SetResourcePermissionCommand
		expectedCode         int
		expectedParentUIDs   []string
		expectedParentTitles []string
		checkAccessControl   bool
	}
	tcs := []testCase{
		{
			description:          "get folder by UID should return parent folders if nested folder are enabled",
			expectedCode:         http.StatusOK,
			expectedParentUIDs:   []string{"parentuid"},
			expectedParentTitles: []string{"testparent"},
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{
					Actions:           []string{dashboards.ActionFoldersRead},
					Resource:          "folders",
					ResourceAttribute: "uid",
					ResourceID:        "*",
				},
			},
			checkAccessControl: true,
		},
		{
			description:          "get folder by UID should not return parent folders if nested folder are enabled and user does not have read access to parent folders",
			expectedCode:         http.StatusOK,
			expectedParentUIDs:   []string{},
			expectedParentTitles: []string{},
			permissions: []resourcepermissions.SetResourcePermissionCommand{
				{
					Actions:           []string{dashboards.ActionFoldersRead},
					Resource:          "folders",
					ResourceAttribute: "uid",
					ResourceID:        "descuid",
				},
			},
		},
		{
			description:          "get folder by UID should not succeed if user doesn't have permissions for the folder",
			expectedCode:         http.StatusForbidden,
			expectedParentUIDs:   []string{},
			expectedParentTitles: []string{},
			permissions:          []resourcepermissions.SetResourcePermissionCommand{},
		},
	}

	// test on all dualwriter modes
	for mode := 0; mode <= 4; mode++ {
		for _, tc := range tcs {
			t.Run(fmt.Sprintf("[Mode: %v] "+tc.description, mode), func(t *testing.T) {
				modeDw := grafanarest.DualWriterMode(mode)
				helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
					AppModeProduction:    true,
					DisableAnonymous:     true,
					APIServerStorageType: "unified",
					UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
						folders.RESOURCEGROUP: {
							DualWriterMode: modeDw,
						},
					},
					EnableFeatureToggles: []string{
						featuremgmt.FlagNestedFolders,
						featuremgmt.FlagKubernetesClientDashboardsFolders,
					},
				})

				// Create parent folder
				parentPayload := `{
				"title": "testparent",
				"uid": "parentuid"
				}`
				parentCreate := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: http.MethodPost,
					Path:   "/api/folders",
					Body:   []byte(parentPayload),
				}, &folder.Folder{})
				require.NotNil(t, parentCreate.Result)
				parentUID := parentCreate.Result.UID
				require.NotEmpty(t, parentUID)

				// Create descendant folder
				payload := "{ \"uid\": \"descuid\", \"title\": \"Folder\", \"parentUid\": \"parentuid\"}"
				resp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: http.MethodPost,
					Path:   "/api/folders",
					Body:   []byte(payload),
				}, &dtos.Folder{})
				require.Equal(t, http.StatusOK, resp.Response.StatusCode)

				user := helper.CreateUser("user", apis.Org1, org.RoleNone, tc.permissions)

				// Get with accesscontrol disabled
				getResp := apis.DoRequest(helper, apis.RequestParams{
					User:   user,
					Method: http.MethodGet,
					Path:   "/api/folders/descuid",
				}, &dtos.Folder{})
				require.Equal(t, tc.expectedCode, getResp.Response.StatusCode)
				require.NotNil(t, getResp.Result)

				require.False(t, getResp.Result.AccessControl[dashboards.ActionFoldersRead])
				require.False(t, getResp.Result.AccessControl[dashboards.ActionFoldersWrite])

				parents := getResp.Result.Parents
				require.Equal(t, len(tc.expectedParentUIDs), len(parents))
				require.Equal(t, len(tc.expectedParentTitles), len(parents))
				for i := 0; i < len(tc.expectedParentUIDs); i++ {
					require.Equal(t, tc.expectedParentUIDs[i], parents[i].UID)
					require.Equal(t, tc.expectedParentTitles[i], parents[i].Title)
				}

				// Get with accesscontrol enabled
				if tc.checkAccessControl {
					acPerms := []resourcepermissions.SetResourcePermissionCommand{
						{
							Actions:           []string{dashboards.ActionFoldersRead},
							Resource:          "folders",
							ResourceAttribute: "uid",
							ResourceID:        "*",
						},
						{
							Actions:           []string{dashboards.ActionFoldersWrite},
							Resource:          "folders",
							ResourceAttribute: "uid",
							ResourceID:        "parentuid",
						},
					}
					acUser := helper.CreateUser("acuser", apis.Org1, org.RoleNone, acPerms)

					getWithAC := apis.DoRequest(helper, apis.RequestParams{
						User:   acUser,
						Method: http.MethodGet,
						Path:   "/api/folders/descuid?accesscontrol=true",
					}, &dtos.Folder{})
					require.Equal(t, tc.expectedCode, getWithAC.Response.StatusCode)
					require.NotNil(t, getWithAC.Result)

					require.True(t, getWithAC.Result.AccessControl[dashboards.ActionFoldersRead])
					require.True(t, getWithAC.Result.AccessControl[dashboards.ActionFoldersWrite])
				}
			})
		}
	}
}

// TestFoldersCreateAPIEndpointK8S is the counterpart of pkg/api/folder_test.go TestFoldersCreateAPIEndpoint
func TestIntegrationFoldersCreateAPIEndpointK8S(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	folderWithoutParentInput := "{ \"uid\": \"uid\", \"title\": \"Folder\"}"
	folderWithTitleEmpty := "{ \"title\": \"\"}"
	folderWithInvalidUid := "{ \"uid\": \"::::::::::::\", \"title\": \"Another folder\"}"
	folderWithUIDTooLong := "{ \"uid\": \"asdfghjklqwertyuiopzxcvbnmasdfghjklqwertyuiopzxcvbnmasdfghjklqwertyuiopzxcvbnm\", \"title\": \"Third folder\"}"

	type testCase struct {
		description            string
		expectedCode           int
		expectedMessage        string
		expectedFolderSvcError error
		permissions            []resourcepermissions.SetResourcePermissionCommand
		input                  string
		createSecondRecord     bool
	}

	folderCreatePermission := []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions:           []string{"folders:create"},
			Resource:          "folders",
			ResourceAttribute: "uid",
			ResourceID:        "*",
		},
	}

	// NOTE: folder creation does not return ErrFolderAccessDenied neither ErrFolderNotFound
	tcs := []testCase{
		{
			description:  "folder creation succeeds given the correct request for creating a folder",
			input:        folderWithoutParentInput,
			expectedCode: http.StatusOK,
			permissions:  folderCreatePermission,
		},
		{
			description:     "folder creation fails without permissions to create a folder",
			input:           folderWithoutParentInput,
			expectedCode:    http.StatusForbidden,
			expectedMessage: fmt.Sprintf("You'll need additional permissions to perform this action. Permissions needed: %s", "folders:create"),
			permissions:     []resourcepermissions.SetResourcePermissionCommand{},
		},
		{
			description:            "folder creation fails given folder service error %s",
			input:                  folderWithTitleEmpty,
			expectedCode:           http.StatusBadRequest,
			expectedMessage:        dashboards.ErrFolderTitleEmpty.Error(),
			expectedFolderSvcError: dashboards.ErrFolderTitleEmpty,
			permissions:            folderCreatePermission,
		},
		{
			description:            "folder creation fails given folder service error %s",
			input:                  folderWithInvalidUid,
			expectedCode:           http.StatusBadRequest,
			expectedMessage:        dashboards.ErrDashboardInvalidUid.Error(),
			expectedFolderSvcError: dashboards.ErrDashboardInvalidUid,
			permissions:            folderCreatePermission,
		},
		{
			description:            "folder creation fails given folder service error %s",
			input:                  folderWithUIDTooLong,
			expectedCode:           http.StatusBadRequest,
			expectedMessage:        dashboards.ErrDashboardUidTooLong.Error(),
			expectedFolderSvcError: dashboards.ErrDashboardUidTooLong,
			permissions:            folderCreatePermission,
		},
		{
			description:            "folder creation fails given folder service error %s",
			input:                  folderWithoutParentInput,
			expectedCode:           http.StatusPreconditionFailed,
			expectedMessage:        dashboards.ErrFolderVersionMismatch.Error(),
			expectedFolderSvcError: dashboards.ErrFolderVersionMismatch,
			createSecondRecord:     true,
			permissions:            folderCreatePermission,
		},
	}

	// test on all dualwriter modes
	for mode := 0; mode <= 4; mode++ {
		for _, tc := range tcs {
			t.Run(fmt.Sprintf("[Mode: %v] "+testDescription(tc.description, tc.expectedFolderSvcError), mode), func(t *testing.T) {
				modeDw := grafanarest.DualWriterMode(mode)
				helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
					AppModeProduction:    true,
					DisableAnonymous:     true,
					APIServerStorageType: "unified",
					UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
						folders.RESOURCEGROUP: {
							DualWriterMode: modeDw,
						},
					},
					EnableFeatureToggles: []string{
						featuremgmt.FlagNestedFolders,
						featuremgmt.FlagKubernetesClientDashboardsFolders,
					},
				})

				userTest := helper.CreateUser("user", apis.Org1, org.RoleViewer, tc.permissions)

				if tc.createSecondRecord {
					client := helper.GetResourceClient(apis.ResourceClientArgs{
						User: helper.Org1.Admin,
						GVR:  gvr,
					})
					create2 := apis.DoRequest(helper, apis.RequestParams{
						User:   client.Args.User,
						Method: http.MethodPost,
						Path:   "/api/folders",
						Body:   []byte(tc.input),
					}, &folder.Folder{})
					require.NotEmpty(t, create2.Response)
					require.Equal(t, http.StatusOK, create2.Response.StatusCode)
				}

				addr := helper.GetEnv().Server.HTTPServer.Listener.Addr()
				login := userTest.Identity.GetLogin()
				baseUrl := fmt.Sprintf("http://%s:%s@%s", login, user.Password("user"), addr)

				req, err := http.NewRequest(http.MethodPost, fmt.Sprintf(
					"%s%s",
					baseUrl,
					"/api/folders",
				), bytes.NewBuffer([]byte(tc.input)))
				require.NoError(t, err)
				req.Header.Set("Content-Type", "application/json")

				resp, err := http.DefaultClient.Do(req)
				require.NoError(t, err)
				require.NotNil(t, resp)
				require.Equal(t, tc.expectedCode, resp.StatusCode)

				type folderWithMessage struct {
					dtos.Folder
					Message string `json:"message"`
				}

				folder := folderWithMessage{}
				err = json.NewDecoder(resp.Body).Decode(&folder)
				require.NoError(t, err)
				require.NoError(t, resp.Body.Close())

				if tc.expectedCode == http.StatusOK {
					require.Equal(t, "uid", folder.UID)
					require.Equal(t, "Folder", folder.Title)
				}

				if tc.expectedMessage != "" {
					require.Equal(t, tc.expectedMessage, folder.Message)
				}
			})
		}
	}
}

func testDescription(description string, expectedErr error) string {
	if expectedErr != nil {
		return fmt.Sprintf(description, expectedErr.Error())
	} else {
		return description
	}
}

// There are no counterpart of TestFoldersGetAPIEndpointK8S in pkg/api/folder_test.go
func TestIntegrationFoldersGetAPIEndpointK8S(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	type testCase struct {
		description         string
		expectedCode        int
		params              string
		createFolders       []string
		expectedOutput      []dtos.FolderSearchHit
		permissions         []resourcepermissions.SetResourcePermissionCommand
		requestToAnotherOrg bool
	}

	folderReadAndCreatePermission := []resourcepermissions.SetResourcePermissionCommand{
		{
			Actions:           []string{"folders:create", "folders:read"},
			Resource:          "folders",
			ResourceAttribute: "uid",
			ResourceID:        "*",
		},
	}

	folder1 := "{ \"uid\": \"foo\", \"title\": \"Folder 1\"}"
	folder2 := "{ \"uid\": \"bar\", \"title\": \"Folder 2\", \"parentUid\": \"foo\"}"
	folder3 := "{ \"uid\": \"qux\", \"title\": \"Folder 3\"}"

	tcs := []testCase{
		{
			description: "listing folders at root level succeeds",
			createFolders: []string{
				folder1,
				folder2,
				folder3,
			},
			expectedCode: http.StatusOK,
			expectedOutput: []dtos.FolderSearchHit{
				{UID: "foo", Title: "Folder 1"},
				{UID: "qux", Title: "Folder 3"},
				{UID: folder.SharedWithMeFolder.UID, Title: folder.SharedWithMeFolder.Title},
			},
			permissions: folderReadAndCreatePermission,
		},
		{
			description: "listing subfolders succeeds",
			createFolders: []string{
				folder1,
				folder2,
				folder3,
			},
			params:       "?parentUid=foo",
			expectedCode: http.StatusOK,
			expectedOutput: []dtos.FolderSearchHit{
				{UID: "bar", Title: "Folder 2", ParentUID: "foo"},
			},
			permissions: folderReadAndCreatePermission,
		},
		{
			description: "listing subfolders for a parent that does not exists",
			createFolders: []string{
				folder1,
				folder2,
				folder3,
			},
			params:         "?parentUid=notexists",
			expectedCode:   http.StatusNotFound,
			expectedOutput: []dtos.FolderSearchHit{},
			permissions:    folderReadAndCreatePermission,
		},
		{
			description: "listing folders at root level fails without the right permissions",
			createFolders: []string{
				folder1,
				folder2,
				folder3,
			},
			params:              "?parentUid=notfound",
			expectedCode:        http.StatusForbidden,
			expectedOutput:      []dtos.FolderSearchHit{},
			permissions:         folderReadAndCreatePermission,
			requestToAnotherOrg: true,
		},
	}

	// test on all dualwriter modes
	for mode := 0; mode <= 4; mode++ {
		for _, tc := range tcs {
			t.Run(fmt.Sprintf("Mode: %d, %s", mode, tc.description), func(t *testing.T) {
				modeDw := grafanarest.DualWriterMode(mode)

				helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
					AppModeProduction:    true,
					DisableAnonymous:     true,
					APIServerStorageType: "unified",
					UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
						folders.RESOURCEGROUP: {
							DualWriterMode: modeDw,
						},
					},
					EnableFeatureToggles: []string{
						featuremgmt.FlagNestedFolders,
						featuremgmt.FlagUnifiedStorageSearch,
						featuremgmt.FlagKubernetesClientDashboardsFolders,
					},
				})

				userTest := helper.CreateUser("user", apis.Org1, org.RoleNone, tc.permissions)

				for _, f := range tc.createFolders {
					client := helper.GetResourceClient(apis.ResourceClientArgs{
						User: userTest,
						GVR:  gvr,
					})
					create2 := apis.DoRequest(helper, apis.RequestParams{
						User:   client.Args.User,
						Method: http.MethodPost,
						Path:   "/api/folders",
						Body:   []byte(f),
					}, &folder.Folder{})
					require.NotEmpty(t, create2.Response)
					require.Equal(t, http.StatusOK, create2.Response.StatusCode)
				}

				addr := helper.GetEnv().Server.HTTPServer.Listener.Addr()
				login := userTest.Identity.GetLogin()
				baseUrl := fmt.Sprintf("http://%s:%s@%s", login, user.Password("user"), addr)

				req, err := http.NewRequest(http.MethodGet, fmt.Sprintf(
					"%s%s",
					baseUrl,
					fmt.Sprintf("/api/folders%s", tc.params),
				), nil)
				require.NoError(t, err)
				req.Header.Set("Content-Type", "application/json")
				if tc.requestToAnotherOrg {
					req.Header.Set("x-grafana-org-id", "2")
				}

				resp, err := http.DefaultClient.Do(req)
				require.NoError(t, err)
				require.NotNil(t, resp)
				require.Equal(t, tc.expectedCode, resp.StatusCode)

				if tc.expectedCode == http.StatusOK {
					list := []dtos.FolderSearchHit{}
					err = json.NewDecoder(resp.Body).Decode(&list)
					require.NoError(t, err)
					require.NoError(t, resp.Body.Close())

					// ignore IDs
					for i := 0; i < len(list); i++ {
						list[i].ID = 0
					}

					require.ElementsMatch(t, tc.expectedOutput, list)
				}
			})
		}
	}
}
