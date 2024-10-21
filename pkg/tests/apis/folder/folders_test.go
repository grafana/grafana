package playlist

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"

	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/api/dtos"
	folderv0alpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

var gvr = schema.GroupVersionResource{
	Group:    "folder.grafana.app",
	Version:  "v0alpha1",
	Resource: "folders",
}

func TestIntegrationFoldersApp(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerTestingWithExperimentalAPIs,
		},
		// Not including featuremgmt.FlagKubernetesFolders because we refer to the k8s client directly in doFolderTests().
		// This allows us to access the legacy api (which gets bypassed by featuremgmt.FlagKubernetesFolders).
	})

	t.Run("Check discovery client", func(t *testing.T) {
		disco := helper.NewDiscoveryClient()
		resources, err := disco.ServerResourcesForGroupVersion("folder.grafana.app/v0alpha1")
		require.NoError(t, err)

		v1Disco, err := json.MarshalIndent(resources, "", "  ")
		require.NoError(t, err)

		require.JSONEq(t, `{
			"kind": "APIResourceList",
			"apiVersion": "v1",
			"groupVersion": "folder.grafana.app/v0alpha1",
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
				"name": "folders/count",
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

	t.Run("with k8s api flag", func(t *testing.T) {
		doFolderTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction: true,
			DisableAnonymous:  true,
			EnableFeatureToggles: []string{
				featuremgmt.FlagGrafanaAPIServerTestingWithExperimentalAPIs,
			},
			// Not including featuremgmt.FlagKubernetesFolders because we refer to the k8s client directly in doFolderTests().
			// This allows us to access the legacy api (which gets bypassed by featuremgmt.FlagKubernetesFolders).
		}))
	})

	t.Run("with dual write (file, mode 0)", func(t *testing.T) {
		doFolderTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "file", // write the files to disk
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				folderv0alpha1.RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode0,
				},
			},
			EnableFeatureToggles: []string{
				featuremgmt.FlagGrafanaAPIServerTestingWithExperimentalAPIs,
			},
			// Not including featuremgmt.FlagKubernetesFolders because we refer to the k8s client directly in doFolderTests().
			// This allows us to access the legacy api (which gets bypassed by featuremgmt.FlagKubernetesFolders).
		}))
	})

	t.Run("with dual write (file, mode 1)", func(t *testing.T) {
		doFolderTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "file", // write the files to disk
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				folderv0alpha1.RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode1,
				},
			},
			EnableFeatureToggles: []string{
				featuremgmt.FlagGrafanaAPIServerTestingWithExperimentalAPIs,
			},
			// Not including featuremgmt.FlagKubernetesFolders because we refer to the k8s client directly in doFolderTests().
			// This allows us to access the legacy api (which gets bypassed by featuremgmt.FlagKubernetesFolders).
		}))
	})

	t.Run("with dual write (unified storage, mode 0)", func(t *testing.T) {
		doFolderTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "unified",
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				folderv0alpha1.RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode0,
				},
			},
			EnableFeatureToggles: []string{
				featuremgmt.FlagGrafanaAPIServerTestingWithExperimentalAPIs,
			},
			// Not including featuremgmt.FlagKubernetesFolders because we refer to the k8s client directly in doFolderTests().
			// This allows us to access the legacy api (which gets bypassed by featuremgmt.FlagKubernetesFolders).
		}))
	})

	t.Run("with dual write (unified storage, mode 1)", func(t *testing.T) {
		doFolderTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "unified",
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				folderv0alpha1.RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode1,
				},
			},
			EnableFeatureToggles: []string{
				featuremgmt.FlagGrafanaAPIServerTestingWithExperimentalAPIs,
			},
			// Not including featuremgmt.FlagKubernetesFolders because we refer to the k8s client directly in doFolderTests().
			// This allows us to access the legacy api (which gets bypassed by featuremgmt.FlagKubernetesFolders).
		}))
	})

	t.Run("with dual write (unified-grpc, mode 0)", func(t *testing.T) {
		doFolderTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "unified-grpc",
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				folderv0alpha1.RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode0,
				},
			},
			EnableFeatureToggles: []string{
				featuremgmt.FlagGrafanaAPIServerTestingWithExperimentalAPIs,
			},
			// Not including featuremgmt.FlagKubernetesFolders because we refer to the k8s client directly in doFolderTests().
			// This allows us to access the legacy api (which gets bypassed by featuremgmt.FlagKubernetesFolders).
		}))
	})

	t.Run("with dual write (unified-grpc, mode 1)", func(t *testing.T) {
		doFolderTests(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "unified-grpc",
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				folderv0alpha1.RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode1,
				},
			},
			EnableFeatureToggles: []string{
				featuremgmt.FlagGrafanaAPIServerTestingWithExperimentalAPIs,
			},
			// Not including featuremgmt.FlagKubernetesFolders because we refer to the k8s client directly in doFolderTests().
			// This allows us to access the legacy api (which gets bypassed by featuremgmt.FlagKubernetesFolders).
		}))
	})

	t.Run("with dual write (etcd, mode 0)", func(t *testing.T) {
		// NOTE: running local etcd, that will be wiped clean!
		t.Skip("local etcd testing")

		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "etcd",
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				folderv0alpha1.RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode0,
				},
			},
			EnableFeatureToggles: []string{
				featuremgmt.FlagGrafanaAPIServerTestingWithExperimentalAPIs,
			},
			// Not including featuremgmt.FlagKubernetesFolders because we refer to the k8s client directly in doFolderTests().
			// This allows us to access the legacy api (which gets bypassed by featuremgmt.FlagKubernetesFolders).
		})

		// Clear the collection before starting (etcd)
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})
		err := client.Resource.DeleteCollection(context.Background(), metav1.DeleteOptions{}, metav1.ListOptions{})
		require.NoError(t, err)

		doFolderTests(t, helper)
	})

	t.Run("with dual write (etcd, mode 1)", func(t *testing.T) {
		// NOTE: running local etcd, that will be wiped clean!
		t.Skip("local etcd testing")

		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "etcd",
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				folderv0alpha1.RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode1,
				},
			},
			EnableFeatureToggles: []string{
				featuremgmt.FlagGrafanaAPIServerTestingWithExperimentalAPIs,
			},
			// Not including featuremgmt.FlagKubernetesFolders because we refer to the k8s client directly in doFolderTests().
			// This allows us to access the legacy api (which gets bypassed by featuremgmt.FlagKubernetesFolders).
		})

		// Clear the collection before starting (etcd)
		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})
		err := client.Resource.DeleteCollection(context.Background(), metav1.DeleteOptions{}, metav1.ListOptions{})
		require.NoError(t, err)

		doFolderTests(t, helper)
	})

	t.Run("with dual write (unified storage, mode 1, create nested folders)", func(t *testing.T) {
		doNestedCreateTest(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "unified",
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				folderv0alpha1.RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode1,
				},
			},
			EnableFeatureToggles: []string{
				featuremgmt.FlagGrafanaAPIServerTestingWithExperimentalAPIs,
				featuremgmt.FlagNestedFolders,
				featuremgmt.FlagKubernetesFolders,
			},
		}))
	})

	t.Run("with dual write (unified storage, mode 1, create existing folder)", func(t *testing.T) {
		doCreateDuplicateFolderTest(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "unified",
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				folderv0alpha1.RESOURCEGROUP: {
					DualWriterMode: grafanarest.Mode1,
				},
			},
			EnableFeatureToggles: []string{
				featuremgmt.FlagGrafanaAPIServerTestingWithExperimentalAPIs,
				featuremgmt.FlagNestedFolders,
				featuremgmt.FlagKubernetesFolders,
			},
		}))
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

		expectedResult := `{
			"apiVersion": "folder.grafana.app/v0alpha1",
			"kind": "Folder",
			"metadata": {
			  "creationTimestamp": "${creationTimestamp}",
			  "name": "` + uid + `",
			  "namespace": "default",
			  "resourceVersion": "${resourceVersion}",
			  "uid": "${uid}"
			},
			"spec": {
			  "title": "Test"
			}
		  }`

		// Get should return the same result
		found, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
		require.NoError(t, err)
		require.JSONEq(t, expectedResult, client.SanitizeJSON(found))
	})

	t.Run("Do CRUD (just CR for now) via k8s (and check that legacy api still works)", func(t *testing.T) {
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

		// Check all playlists
		for _, uid := range uids {
			getFromBothAPIs(t, helper, client, uid, nil)
		}
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
	require.Equal(t, parentUID, parent.UID)
	require.Equal(t, "Test\\/parent", parent.Title)
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
	require.Equal(t, 409, create2.Response.StatusCode)
}

func TestIntegrationFolderCreatePermissions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
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

	for _, tc := range tcs {
		t.Run(tc.description, func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    true,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folderv0alpha1.RESOURCEGROUP: {
						DualWriterMode: grafanarest.Mode1,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerTestingWithExperimentalAPIs,
					featuremgmt.FlagNestedFolders,
					featuremgmt.FlagKubernetesFolders,
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
