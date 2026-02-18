package folder

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	k8srest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	alerting "github.com/grafana/grafana/pkg/tests/api/alerting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
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
	testutil.SkipIntegrationTestInShortMode(t)

	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	t.Run("Check discovery client", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			EnableFeatureToggles: []string{},
		})
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
				DisableDataMigrations: true,
				AppModeProduction:     true,
				DisableAnonymous:      true,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
				},
				EnableFeatureToggles: []string{},
			}))
		})

		t.Run(fmt.Sprintf("with dual write (unified storage, mode %v, create nested folders)", modeDw), func(t *testing.T) {
			doNestedCreateTest(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableDataMigrations: true,
				AppModeProduction:     true,
				DisableAnonymous:      true,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
				},
			}))
		})

		t.Run(fmt.Sprintf("with dual write (unified storage, mode %v, create existing folder)", modeDw), func(t *testing.T) {
			doCreateDuplicateFolderTest(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableDataMigrations: true,
				AppModeProduction:     true,
				DisableAnonymous:      true,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
				},
			}))
		})

		t.Run(fmt.Sprintf("when creating a folder, mode %v, it should trim leading and trailing spaces", modeDw), func(t *testing.T) {
			doCreateEnsureTitleIsTrimmedTest(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableDataMigrations: true,
				AppModeProduction:     true,
				DisableAnonymous:      true,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
				},
			}))
		})

		t.Run(fmt.Sprintf("with dual write (unified storage, mode %v, create circular reference folder)", modeDw), func(t *testing.T) {
			doCreateCircularReferenceFolderTest(t, apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableDataMigrations: true,
				AppModeProduction:     true,
				DisableAnonymous:      true,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
				},
			}))
		})
	}

	// This is a general test for the unified storage list operation. We don't have a common test
	// directory for now, so we (search and storage) keep it here as we own this part of the tests.
	t.Run("make sure list works with continue tokens", func(t *testing.T) {
		t.Skip("Skipping flaky test - list works with continue tokens")
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
					DisableDataMigrations: true,
					AppModeProduction:     true,
					DisableAnonymous:      true,
					APIServerStorageType:  "unified",
					UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
						folders.RESOURCEGROUP: {
							DualWriterMode: mode,
						},
					},
					// We set it to 1 here, so we always get forced pagination based on the response size.
					UnifiedStorageMaxPageSizeBytes: 1,
				}), mode)
			})
		}
	})
}

// Validates that folder delete checks alert_rule stats and blocks deletion
func TestIntegrationFolderDeletionBlockedByAlertRules(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	t.Run("should be blocked by alert rules", func(t *testing.T) {
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			AppModeProduction:    true,
			DisableAnonymous:     true,
			APIServerStorageType: "unified",
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				folders.RESOURCEGROUP: {DualWriterMode: grafanarest.Mode5},
			},
			UnifiedStorageEnableSearch: true,
		})

		client := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  gvr,
		})

		// Create a folder via legacy API so it is visible everywhere.
		folderUID := "alertrule-del-test"
		legacyPayload := fmt.Sprintf(`{"title": "Folder With Alert Rule", "uid": "%s"}`, folderUID)
		legacyCreate := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodPost,
			Path:   "/api/folders",
			Body:   []byte(legacyPayload),
		}, &folder.Folder{})
		require.NotNil(t, legacyCreate.Result)
		require.Equal(t, folderUID, legacyCreate.Result.UID)

		// Create one alert rule in that folder namespace via ruler API.
		addr := helper.GetEnv().Server.HTTPServer.Listener.Addr().String()
		api := alerting.NewAlertingLegacyAPIClient(addr, "admin", "admin")

		// simple always-true rule
		forDuration := model.Duration(10 * time.Second)
		rule := apimodels.PostableExtendedRuleNode{
			ApiRuleNode: &apimodels.ApiRuleNode{For: &forDuration},
			GrafanaManagedAlert: &apimodels.PostableGrafanaRule{
				Title:     "rule-in-folder",
				Condition: "A",
				Data: []apimodels.AlertQuery{
					{
						RefID:         "A",
						DatasourceUID: expr.DatasourceUID,
						RelativeTimeRange: apimodels.RelativeTimeRange{
							From: apimodels.Duration(600 * time.Second),
							To:   0,
						},
						Model: json.RawMessage(`{"type":"math","expression":"2 + 3 > 1"}`),
					},
				},
			},
		}
		group := apimodels.PostableRuleGroupConfig{
			Name:     "arulegroup",
			Interval: model.Duration(10 * time.Second),
			Rules:    []apimodels.PostableExtendedRuleNode{rule},
		}
		_ = api.PostRulesGroup(t, folderUID, &group, false)

		// Attempt to delete the folder via K8s API. This should be blocked by alert rules.
		err := client.Resource.Delete(context.Background(), folderUID, metav1.DeleteOptions{})
		require.Error(t, err, "expected folder deletion to be blocked when alert rules exist")

		// Delete the rule group from ruler.
		status, body := api.DeleteRulesGroup(t, folderUID, group.Name, true)
		require.Equalf(t, http.StatusAccepted, status, body)

		// Now we should be able to delete the folder.
		err = client.Resource.Delete(context.Background(), folderUID, metav1.DeleteOptions{})
		require.NoError(t, err)
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
			}}`

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
	testutil.SkipIntegrationTestInShortMode(t)

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
		t.Run(fmt.Sprintf("Mode_%d", mode), func(t *testing.T) {
			modeDw := grafanarest.DualWriterMode(mode)
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableDataMigrations: true,
				AppModeProduction:     true,
				DisableAnonymous:      true,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
				},
			})
			for i, tc := range tcs {
				t.Run(fmt.Sprintf("[Mode: %v] "+tc.description, mode), func(t *testing.T) {
					username := fmt.Sprintf("user-%d", i)
					parentUID := fmt.Sprintf("parentuid-%d", i)
					childUID := fmt.Sprintf("uid-%d", i)

					// Update permissions to use unique parent UID
					permissions := make([]resourcepermissions.SetResourcePermissionCommand, len(tc.permissions))
					for j, perm := range tc.permissions {
						permissions[j] = perm
						if perm.ResourceID == "parentuid" {
							permissions[j].ResourceID = parentUID
						}
					}

					user := helper.CreateUser(username, apis.Org1, org.RoleViewer, permissions)

					// Get user ID for cleanup
					userID, _ := user.Identity.GetInternalID()

					// Register cleanup for this test case
					t.Cleanup(helper.CleanupTestResources([]string{parentUID, childUID}, []int64{userID}))

					parentPayload := fmt.Sprintf(`{
				"title": "Test/parent",
				"uid": "%s"
				}`, parentUID)
					parentCreate := apis.DoRequest(helper, apis.RequestParams{
						User:   helper.Org1.Admin,
						Method: http.MethodPost,
						Path:   "/api/folders",
						Body:   []byte(parentPayload),
					}, &folder.Folder{})
					require.NotNil(t, parentCreate.Result)
					createdParentUID := parentCreate.Result.UID
					require.NotEmpty(t, createdParentUID)

					// Update input to use unique UIDs
					input := strings.ReplaceAll(tc.input, "parentuid", parentUID)
					input = strings.ReplaceAll(input, `"uid": "uid"`, fmt.Sprintf(`"uid": "%s"`, childUID))

					resp := apis.DoRequest(helper, apis.RequestParams{
						User:   user,
						Method: http.MethodPost,
						Path:   "/api/folders",
						Body:   []byte(input),
					}, &dtos.Folder{})
					require.Equal(t, tc.expectedCode, resp.Response.StatusCode)

					if tc.expectedCode == http.StatusOK {
						require.Equal(t, childUID, resp.Result.UID)
						require.Equal(t, "Folder", resp.Result.Title)
					}
				})
			}
		})
	}
}

func TestIntegrationFolderGetPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
		t.Run(fmt.Sprintf("Mode_%d", mode), func(t *testing.T) {
			modeDw := grafanarest.DualWriterMode(mode)
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableDataMigrations: true,
				AppModeProduction:     true,
				DisableAnonymous:      true,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
				},
			})

			// Run all test cases within the same server instance
			for i, tc := range tcs {
				t.Run(tc.description, func(t *testing.T) {
					// Use unique UIDs per test case to avoid conflicts
					parentUID := fmt.Sprintf("parentuid-%d", i)
					descUID := fmt.Sprintf("descuid-%d", i)
					parentTitle := fmt.Sprintf("testparent-%d", i)
					userLogin := fmt.Sprintf("user-%d", i)
					acUserLogin := fmt.Sprintf("acuser-%d", i)

					// Create parent folder
					parentPayload := fmt.Sprintf(`{
					"title": "%s",
					"uid": "%s"
					}`, parentTitle, parentUID)
					parentCreate := apis.DoRequest(helper, apis.RequestParams{
						User:   helper.Org1.Admin,
						Method: http.MethodPost,
						Path:   "/api/folders",
						Body:   []byte(parentPayload),
					}, &folder.Folder{})
					require.NotNil(t, parentCreate.Result)
					require.Equal(t, parentUID, parentCreate.Result.UID)

					// Create descendant folder
					payload := fmt.Sprintf(`{ "uid": "%s", "title": "Folder-%d", "parentUid": "%s"}`, descUID, i, parentUID)
					resp := apis.DoRequest(helper, apis.RequestParams{
						User:   helper.Org1.Admin,
						Method: http.MethodPost,
						Path:   "/api/folders",
						Body:   []byte(payload),
					}, &dtos.Folder{})
					require.Equal(t, http.StatusOK, resp.Response.StatusCode)

					// Update permissions to use unique descUID where needed
					permissions := tc.permissions
					for j := range permissions {
						if permissions[j].ResourceID == "descuid" {
							permissions[j].ResourceID = descUID
						}
					}

					user := helper.CreateUser(userLogin, apis.Org1, org.RoleNone, permissions)

					// Get user ID for cleanup
					userID, err := user.Identity.GetInternalID()
					require.NoError(t, err)

					// Register cleanup to delete created resources
					t.Cleanup(helper.CleanupTestResources([]string{descUID, parentUID}, []int64{userID}))

					// Adjust expected UIDs and titles
					expectedParentUIDs := tc.expectedParentUIDs
					expectedParentTitles := tc.expectedParentTitles
					if len(expectedParentUIDs) > 0 {
						expectedParentUIDs = []string{parentUID}
						expectedParentTitles = []string{parentTitle}
					}

					// Get with accesscontrol disabled
					getResp := apis.DoRequest(helper, apis.RequestParams{
						User:   user,
						Method: http.MethodGet,
						Path:   "/api/folders/" + descUID,
					}, &dtos.Folder{})
					require.Equal(t, tc.expectedCode, getResp.Response.StatusCode)

					if tc.expectedCode == http.StatusOK {
						require.NotNil(t, getResp.Result)
						require.False(t, getResp.Result.AccessControl[dashboards.ActionFoldersRead])
						require.False(t, getResp.Result.AccessControl[dashboards.ActionFoldersWrite])

						parents := getResp.Result.Parents
						require.Equal(t, len(expectedParentUIDs), len(parents))
						require.Equal(t, len(expectedParentTitles), len(parents))
						for j := 0; j < len(expectedParentUIDs); j++ {
							require.Equal(t, expectedParentUIDs[j], parents[j].UID)
							require.Equal(t, expectedParentTitles[j], parents[j].Title)
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
									ResourceID:        parentUID,
								},
							}
							acUser := helper.CreateUser(acUserLogin, apis.Org1, org.RoleNone, acPerms)

							// Get user ID for cleanup
							acUserID, err := acUser.Identity.GetInternalID()
							require.NoError(t, err)
							t.Cleanup(helper.CleanupTestResources([]string{}, []int64{acUserID}))

							getWithAC := apis.DoRequest(helper, apis.RequestParams{
								User:   acUser,
								Method: http.MethodGet,
								Path:   "/api/folders/" + descUID + "?accesscontrol=true",
							}, &dtos.Folder{})
							require.Equal(t, tc.expectedCode, getWithAC.Response.StatusCode)
							require.NotNil(t, getWithAC.Result)

							require.True(t, getWithAC.Result.AccessControl[dashboards.ActionFoldersRead])
							require.True(t, getWithAC.Result.AccessControl[dashboards.ActionFoldersWrite])
						}
					}
				})
			}
		})
	}
}

// TestFoldersCreateAPIEndpointK8S is the counterpart of pkg/api/folder_test.go TestFoldersCreateAPIEndpoint
func TestIntegrationFoldersCreateAPIEndpointK8S(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
		modeDw := grafanarest.DualWriterMode(mode)
		helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
			DisableDataMigrations: true,
			AppModeProduction:     true,
			DisableAnonymous:      true,
			APIServerStorageType:  "unified",
			UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
				folders.RESOURCEGROUP: {
					DualWriterMode: modeDw,
				},
			},
		})
		for i, tc := range tcs {
			t.Run(fmt.Sprintf("[Mode: %v] "+testDescription(tc.description, tc.expectedFolderSvcError), mode), func(t *testing.T) {
				username := fmt.Sprintf("user-%d", i)
				folderUID := fmt.Sprintf("uid-%d", i)

				// Update input to use unique UIDs
				input := strings.ReplaceAll(tc.input, `"uid": "uid"`, fmt.Sprintf(`"uid": "%s"`, folderUID))

				userTest := helper.CreateUser(username, apis.Org1, org.RoleViewer, tc.permissions)

				if tc.createSecondRecord {
					client := helper.GetResourceClient(apis.ResourceClientArgs{
						User: helper.Org1.Admin,
						GVR:  gvr,
					})
					create2 := apis.DoRequest(helper, apis.RequestParams{
						User:   client.Args.User,
						Method: http.MethodPost,
						Path:   "/api/folders",
						Body:   []byte(input),
					}, &folder.Folder{})
					require.NotEmpty(t, create2.Response)
					require.Equal(t, http.StatusOK, create2.Response.StatusCode)
				}

				addr := helper.GetEnv().Server.HTTPServer.Listener.Addr()
				login := userTest.Identity.GetLogin()
				baseUrl := fmt.Sprintf("http://%s:%s@%s", login, user.Password(username), addr)

				req, err := http.NewRequest(http.MethodPost, fmt.Sprintf(
					"%s%s",
					baseUrl,
					"/api/folders",
				), bytes.NewBuffer([]byte(input)))
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
					require.Equal(t, folderUID, folder.UID)
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
	testutil.SkipIntegrationTestInShortMode(t)

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

	for mode := 0; mode <= 4; mode++ {
		t.Run(fmt.Sprintf("Mode_%d", mode), func(t *testing.T) {
			modeDw := grafanarest.DualWriterMode(mode)

			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableDataMigrations: true,
				AppModeProduction:     true,
				DisableAnonymous:      true,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
				},
				UnifiedStorageEnableSearch: true,
			})

			// Run all test cases within the same server instance
			for i, tc := range tcs {
				t.Run(tc.description, func(t *testing.T) {
					// Use unique UIDs for folders to avoid conflicts between test cases
					userTest := helper.CreateUser(fmt.Sprintf("user-%d", i), apis.Org1, org.RoleNone, tc.permissions)

					// Create folders with unique UIDs per test case
					for _, f := range tc.createFolders {
						// Replace hardcoded UIDs with unique ones
						uniqueFolder := f
						uniqueFolder = strings.Replace(uniqueFolder, `"foo"`, fmt.Sprintf(`"foo-%d"`, i), 1)
						uniqueFolder = strings.Replace(uniqueFolder, `"bar"`, fmt.Sprintf(`"bar-%d"`, i), 1)
						uniqueFolder = strings.Replace(uniqueFolder, `"qux"`, fmt.Sprintf(`"qux-%d"`, i), 1)
						uniqueFolder = strings.Replace(uniqueFolder, `"parentUid": "foo"`, fmt.Sprintf(`"parentUid": "foo-%d"`, i), 1)

						client := helper.GetResourceClient(apis.ResourceClientArgs{
							User: userTest,
							GVR:  gvr,
						})
						create2 := apis.DoRequest(helper, apis.RequestParams{
							User:   client.Args.User,
							Method: http.MethodPost,
							Path:   "/api/folders",
							Body:   []byte(uniqueFolder),
						}, &folder.Folder{})
						require.NotEmpty(t, create2.Response)
						require.Equal(t, http.StatusOK, create2.Response.StatusCode)
					}

					addr := helper.GetEnv().Server.HTTPServer.Listener.Addr()
					login := userTest.Identity.GetLogin()
					baseUrl := fmt.Sprintf("http://%s:%s@%s", login, user.Password(fmt.Sprintf("user-%d", i)), addr)

					// Adjust params with unique UIDs
					params := tc.params
					params = strings.ReplaceAll(params, "foo", fmt.Sprintf("foo-%d", i))

					req, err := http.NewRequest(http.MethodGet, fmt.Sprintf(
						"%s%s",
						baseUrl,
						fmt.Sprintf("/api/folders%s", params),
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

						// Adjust expected output with unique UIDs
						expectedOutput := make([]dtos.FolderSearchHit, len(tc.expectedOutput))
						for j, output := range tc.expectedOutput {
							expectedOutput[j] = output
							expectedOutput[j].ID = 0 // ignore IDs
							switch output.UID {
							case "foo":
								expectedOutput[j].UID = fmt.Sprintf("foo-%d", i)
							case "bar":
								expectedOutput[j].UID = fmt.Sprintf("bar-%d", i)
								expectedOutput[j].ParentUID = fmt.Sprintf("foo-%d", i)
							case "qux":
								expectedOutput[j].UID = fmt.Sprintf("qux-%d", i)
							}
						}

						// ignore IDs in actual list
						for j := 0; j < len(list); j++ {
							list[j].ID = 0
						}

						require.ElementsMatch(t, expectedOutput, list)
					}
				})
			}
		})
	}
}

// Reproduces a bug where folder deletion does not check for attached library panels.
func TestIntegrationFolderDeletionBlockedByLibraryElements(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	for mode := 0; mode <= 5; mode++ {
		t.Run(fmt.Sprintf("with dual write (unified storage, mode %v, delete blocked by library elements)", grafanarest.DualWriterMode(mode)), func(t *testing.T) {
			modeDw := grafanarest.DualWriterMode(mode)

			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableDataMigrations: true,
				AppModeProduction:     true,
				DisableAnonymous:      true,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagKubernetesLibraryPanels,
				},
				UnifiedStorageEnableSearch: true,
			})

			client := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  gvr,
			})

			// Create a folder via legacy API (/api/folders) so it is visible to both paths
			folderUID := fmt.Sprintf("libpanel-del-%d", mode)
			legacyPayload := fmt.Sprintf(`{
                "title": "Folder With Library Panel %d",
                "uid": "%s"
            }`, mode, folderUID)

			legacyCreate := apis.DoRequest(helper, apis.RequestParams{
				User:   client.Args.User,
				Method: http.MethodPost,
				Path:   "/api/folders",
				Body:   []byte(legacyPayload),
			}, &folder.Folder{})
			require.NotNil(t, legacyCreate.Result)
			require.Equal(t, folderUID, legacyCreate.Result.UID)

			// Create a library element inside the folder via /api to simulate an attached library panel
			libElementPayload := fmt.Sprintf(`{
                "kind": 1,
                "name": "LP in %s",
                "folderUid": "%s",
                "model": {
                    "type": "text",
                    "title": "LP in %s"
                }
            }`, folderUID, folderUID, folderUID)

			libCreate := apis.DoRequest(helper, apis.RequestParams{
				User:   client.Args.User,
				Method: http.MethodPost,
				Path:   "/api/library-elements",
				Body:   []byte(libElementPayload),
			}, &struct{}{})
			require.NotNil(t, libCreate.Response)
			require.Equal(t, http.StatusOK, libCreate.Response.StatusCode)

			// Attempt to delete the folder via K8s API. This should be blocked (ErrFolderNotEmpty)
			err := client.Resource.Delete(context.Background(), folderUID, metav1.DeleteOptions{})
			require.Error(t, err, "expected folder deletion to be blocked when library panels exist")

			// Verify the folder still exists
			_, getErr := client.Resource.Get(context.Background(), folderUID, metav1.GetOptions{})
			require.NoError(t, getErr, "folder should still exist after failed deletion")
		})
	}
}

func TestIntegrationRootFolderDeletionBlockedByLibraryElementsInSubfolder(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	// TODO: re-enable on mode 4 and 5 when we migrate /api to /apis for library connections, and begin to
	// use search to return the connections, rather than the connections table.
	for mode := 0; mode <= 3; mode++ {
		t.Run(fmt.Sprintf("with dual write (unified storage, mode %v, delete parent blocked by library elements in child)", grafanarest.DualWriterMode(mode)), func(t *testing.T) {
			modeDw := grafanarest.DualWriterMode(mode)

			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableDataMigrations: true,
				AppModeProduction:     true,
				DisableAnonymous:      true,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagKubernetesLibraryPanels,
				},
				UnifiedStorageEnableSearch: true,
			})

			client := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  gvr,
			})

			parentUID := fmt.Sprintf("libpanel-parent-%d", mode)
			parentPayload := fmt.Sprintf(`{
				"title": "Parent Folder %d",
				"uid": "%s"
			}`, mode, parentUID)
			parentCreate := apis.DoRequest(helper, apis.RequestParams{
				User:   client.Args.User,
				Method: http.MethodPost,
				Path:   "/api/folders",
				Body:   []byte(parentPayload),
			}, &folder.Folder{})
			require.NotNil(t, parentCreate.Result)
			require.Equal(t, parentUID, parentCreate.Result.UID)

			childUID := fmt.Sprintf("libpanel-child-%d", mode)
			childPayload := fmt.Sprintf(`{
				"title": "Child Folder %d",
				"uid": "%s",
				"parentUid": "%s"
			}`, mode, childUID, parentUID)
			childCreate := apis.DoRequest(helper, apis.RequestParams{
				User:   client.Args.User,
				Method: http.MethodPost,
				Path:   "/api/folders",
				Body:   []byte(childPayload),
			}, &folder.Folder{})
			require.NotNil(t, childCreate.Result)
			require.Equal(t, childUID, childCreate.Result.UID)
			require.Equal(t, parentUID, childCreate.Result.ParentUID)

			libElementPayload := fmt.Sprintf(`{
				"kind": 1,
				"name": "LP in %s",
				"folderUid": "%s",
				"model": {
					"type": "text",
					"title": "LP in %s"
				}
			}`, childUID, childUID, childUID)

			libCreate := apis.DoRequest(helper, apis.RequestParams{
				User:   client.Args.User,
				Method: http.MethodPost,
				Path:   "/api/library-elements",
				Body:   []byte(libElementPayload),
			}, &struct{}{})
			require.NotNil(t, libCreate.Response)
			require.Equal(t, http.StatusOK, libCreate.Response.StatusCode)

			// Attempt to delete the parent folder; should be blocked because child folder contains a library panel
			err := client.Resource.Delete(context.Background(), parentUID, metav1.DeleteOptions{})
			require.Error(t, err, "expected parent folder deletion to be blocked when child contains library panels")

			// Verify both folders still exist
			_, getParentErr := client.Resource.Get(context.Background(), parentUID, metav1.GetOptions{})
			require.NoError(t, getParentErr, "parent folder should still exist after failed deletion")
			_, getChildErr := client.Resource.Get(context.Background(), childUID, metav1.GetOptions{})
			require.NoError(t, getChildErr, "child folder should still exist after failed deletion")
		})
	}
}

// Test folder deletion with connected (in-use) library panels - should be blocked
func TestIntegrationFolderDeletionBlockedByConnectedLibraryPanels(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	// TODO: re-enable on mode 4 and 5 when we migrate /api to /apis for library connections, and begin to
	// use search to return the connections, rather than the connections table.
	for mode := 0; mode <= 3; mode++ {
		t.Run(fmt.Sprintf("mode %v - delete blocked by connected library panels in folder and subfolder", grafanarest.DualWriterMode(mode)), func(t *testing.T) {
			modeDw := grafanarest.DualWriterMode(mode)

			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableDataMigrations: true,
				AppModeProduction:     true,
				DisableAnonymous:      true,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
					"dashboards.dashboard.grafana.app": {
						DualWriterMode: modeDw,
					},
				},
				UnifiedStorageEnableSearch: true,
			})

			client := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  gvr,
			})

			// Create parent and child folders
			uid := uuid.NewString()[:8]
			parentUID := fmt.Sprintf("connected-parent-%d-%s", mode, uid)
			childUID := fmt.Sprintf("connected-child-%d-%s", mode, uid)
			createTestFolder(t, helper, client, parentUID, fmt.Sprintf("Parent Folder %d-%s", mode, uid), "")
			createTestFolder(t, helper, client, childUID, fmt.Sprintf("Child Folder %d-%s", mode, uid), parentUID)

			// Create library panels in both folders
			parentLibPanelName := fmt.Sprintf("Connected LP in parent %d-%s", mode, uid)
			childLibPanelName := fmt.Sprintf("Connected LP in child %d-%s", mode, uid)
			parentLibPanelUID := createTestLibraryPanel(t, helper, client, parentLibPanelName, parentUID)
			childLibPanelUID := createTestLibraryPanel(t, helper, client, childLibPanelName, childUID)

			// Create dashboards using library panels (makes them connected)
			parentDashUID := createDashboardWithLibraryPanel(t, helper, client,
				fmt.Sprintf("Dashboard with LP in parent %d-%s", mode, uid),
				parentLibPanelUID, "Connected LP in parent", parentUID)
			childDashUID := createDashboardWithLibraryPanel(t, helper, client,
				fmt.Sprintf("Dashboard with LP in child %d-%s", mode, uid),
				childLibPanelUID, "Connected LP in child", childUID)

			// Attempt to delete the parent folder - should be blocked because library panels are connected
			parentDelete := apis.DoRequest(helper, apis.RequestParams{
				User:   client.Args.User,
				Method: http.MethodDelete,
				Path:   "/api/folders/" + parentUID,
			}, &folder.Folder{})
			require.Equal(t, http.StatusForbidden, parentDelete.Response.StatusCode)

			// Verify both folders still exist
			_, getParentErr := client.Resource.Get(context.Background(), parentUID, metav1.GetOptions{})
			require.NoError(t, getParentErr, "parent folder should still exist after failed deletion")
			_, getChildErr := client.Resource.Get(context.Background(), childUID, metav1.GetOptions{})
			require.NoError(t, getChildErr, "child folder should still exist after failed deletion")

			// Verify library panels still exist
			verifyLibraryPanelExists(t, helper, client, parentLibPanelUID)
			verifyLibraryPanelExists(t, helper, client, childLibPanelUID)

			// Verify dashboards still exist
			verifyDashboardExists(t, helper, client, parentDashUID)
			verifyDashboardExists(t, helper, client, childDashUID)
		})
	}
}

// Test folder deletion with dangling (unconnected) library panels - should succeed and clean up
func TestIntegrationFolderDeletionWithDanglingLibraryPanels(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	for mode := 0; mode <= 5; mode++ {
		t.Run(fmt.Sprintf("mode %v - delete succeeds and cleans up dangling library panels in folder and subfolder", grafanarest.DualWriterMode(mode)), func(t *testing.T) {
			modeDw := grafanarest.DualWriterMode(mode)

			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableDataMigrations: true,
				AppModeProduction:     true,
				DisableAnonymous:      true,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
				},
				UnifiedStorageEnableSearch: true,
			})

			client := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  gvr,
			})

			// Create parent and child folders
			uid := uuid.NewString()[:8]
			parentUID := fmt.Sprintf("dangling-parent-%d-%s", mode, uid)
			childUID := fmt.Sprintf("dangling-child-%d-%s", mode, uid)
			createTestFolder(t, helper, client, parentUID, fmt.Sprintf("Parent Folder %d-%s", mode, uid), "")
			createTestFolder(t, helper, client, childUID, fmt.Sprintf("Child Folder %d-%s", mode, uid), parentUID)

			// Create dangling library panels in both folders (not connected to any dashboard)
			parentLibPanelUID := createTestLibraryPanel(t, helper, client,
				fmt.Sprintf("Dangling LP in parent %d-%s", mode, uid), parentUID)
			childLibPanelUID := createTestLibraryPanel(t, helper, client,
				fmt.Sprintf("Dangling LP in child %d-%s", mode, uid), childUID)

			// Verify library panels exist before deletion
			verifyLibraryPanelExists(t, helper, client, parentLibPanelUID)
			verifyLibraryPanelExists(t, helper, client, childLibPanelUID)

			// Attempt to delete the parent folder - should be blocked because library panels are connected
			parentDelete := apis.DoRequest(helper, apis.RequestParams{
				User:   client.Args.User,
				Method: http.MethodDelete,
				Path:   "/api/folders/" + parentUID,
			}, &folder.Folder{})
			require.Equal(t, http.StatusOK, parentDelete.Response.StatusCode, parentDelete.Body)
			// Verify folders are deleted
			_, getParentErr := client.Resource.Get(context.Background(), parentUID, metav1.GetOptions{})
			require.Error(t, getParentErr, "parent folder should not exist after deletion")
			_, getChildErr := client.Resource.Get(context.Background(), childUID, metav1.GetOptions{})
			require.Error(t, getChildErr, "child folder should not exist after deletion")

			// Verify dangling library panels were cleaned up
			verifyLibraryPanelDeleted(t, helper, client, parentLibPanelUID, "dangling library panel in parent should be deleted")
			verifyLibraryPanelDeleted(t, helper, client, childLibPanelUID, "dangling library panel in child should be deleted")
		})
	}
}

// Helper function to create a folder with specified UID and optional parent
func createTestFolder(t *testing.T, helper *apis.K8sTestHelper, client *apis.K8sResourceClient, uid, title, parentUID string) *folder.Folder {
	t.Helper()

	payload := fmt.Sprintf(`{
		"title": "%s",
		"uid": "%s"`, title, uid)

	if parentUID != "" {
		payload += fmt.Sprintf(`,
		"parentUid": "%s"`, parentUID)
	}

	payload += "}"

	folderCreate := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodPost,
		Path:   "/api/folders",
		Body:   []byte(payload),
	}, &folder.Folder{})

	require.NotNil(t, folderCreate.Result)
	require.Equal(t, uid, folderCreate.Result.UID)

	return folderCreate.Result
}

// Helper function to create a library panel in a folder
func createTestLibraryPanel(t *testing.T, helper *apis.K8sTestHelper, client *apis.K8sResourceClient, name, folderUID string) string {
	t.Helper()

	libPanelPayload := fmt.Sprintf(`{
		"kind": 1,
		"name": "%s",
		"folderUid": "%s",
		"model": {
			"type": "text",
			"title": "%s"
		}
	}`, name, folderUID, name)

	libCreate := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodPost,
		Path:   "/api/library-elements",
		Body:   []byte(libPanelPayload),
	}, &map[string]interface{}{})

	require.NotNil(t, libCreate.Response)
	require.Equal(t, http.StatusOK, libCreate.Response.StatusCode)

	libPanelUID := (*libCreate.Result)["result"].(map[string]interface{})["uid"].(string)
	require.NotEmpty(t, libPanelUID)

	return libPanelUID
}

// Helper function to create a dashboard that uses a library panel
func createDashboardWithLibraryPanel(t *testing.T, helper *apis.K8sTestHelper, client *apis.K8sResourceClient, dashTitle, libPanelUID, libPanelName, folderUID string) string {
	t.Helper()

	dashPayload := fmt.Sprintf(`{
		"dashboard": {
			"title": "%s",
			"panels": [{
				"id": 1,
				"libraryPanel": {
					"uid": "%s",
					"name": "%s"
				}
			}]
		},
		"folderUid": "%s",
		"overwrite": false
	}`, dashTitle, libPanelUID, libPanelName, folderUID)

	dashCreate := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodPost,
		Path:   "/api/dashboards/db",
		Body:   []byte(dashPayload),
	}, &map[string]interface{}{})

	require.NotNil(t, dashCreate.Response)
	require.Equal(t, http.StatusOK, dashCreate.Response.StatusCode)

	// Extract dashboard UID from response
	dashUID := (*dashCreate.Result)["uid"].(string)
	require.NotEmpty(t, dashUID)

	return dashUID
}

// Helper function to verify library panel exists
func verifyLibraryPanelExists(t *testing.T, helper *apis.K8sTestHelper, client *apis.K8sResourceClient, libPanelUID string) {
	t.Helper()

	libGet := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodGet,
		Path:   fmt.Sprintf("/api/library-elements/%s", libPanelUID),
	}, &map[string]interface{}{})

	require.Equal(t, http.StatusOK, libGet.Response.StatusCode)
}

// Helper function to verify library panel does not exist
func verifyLibraryPanelDeleted(t *testing.T, helper *apis.K8sTestHelper, client *apis.K8sResourceClient, libPanelUID, message string) {
	t.Helper()

	libGet := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodGet,
		Path:   fmt.Sprintf("/api/library-elements/%s", libPanelUID),
	}, &map[string]interface{}{})

	require.Equal(t, http.StatusNotFound, libGet.Response.StatusCode, message)
}

// Helper function to verify dashboard exists by UID
func verifyDashboardExists(t *testing.T, helper *apis.K8sTestHelper, client *apis.K8sResourceClient, dashUID string) {
	t.Helper()

	dashGet := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodGet,
		Path:   fmt.Sprintf("/api/dashboards/uid/%s", dashUID),
	}, &map[string]interface{}{})

	require.Equal(t, http.StatusOK, dashGet.Response.StatusCode, fmt.Sprintf("dashboard %s should still exist", dashUID))
}

// Test moving folders to root.
func TestIntegrationMoveNestedFolderToRootK8S(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    true,
		DisableAnonymous:     true,
		APIServerStorageType: "unified",
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			folders.RESOURCEGROUP: {
				DualWriterMode: grafanarest.Mode5,
			},
		},
		UnifiedStorageEnableSearch: true,
	})

	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})

	// Create f1 under root
	f1Payload := `{"title":"Folder 1","uid":"f1"}`
	createF1 := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodPost,
		Path:   "/api/folders",
		Body:   []byte(f1Payload),
	}, &dtos.Folder{})
	require.NotNil(t, createF1.Result)
	require.Equal(t, http.StatusOK, createF1.Response.StatusCode)
	require.Equal(t, "f1", createF1.Result.UID)
	require.Equal(t, "", createF1.Result.ParentUID)

	// Create f2 under f1
	f2Payload := `{"title":"Folder 2","uid":"f2","parentUid":"f1"}`
	createF2 := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodPost,
		Path:   "/api/folders",
		Body:   []byte(f2Payload),
	}, &dtos.Folder{})
	require.NotNil(t, createF2.Result)
	require.Equal(t, http.StatusOK, createF2.Response.StatusCode)
	require.Equal(t, "f2", createF2.Result.UID)
	require.Equal(t, "f1", createF2.Result.ParentUID)

	// Move f2 to the root by having parentUid being empty in the request body
	move := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodPost,
		Path:   "/api/folders/f2/move",
		Body:   []byte(`{"parentUid":""}`),
	}, &dtos.Folder{})
	require.NotNil(t, move.Result)
	require.Equal(t, http.StatusOK, move.Response.StatusCode)
	require.Equal(t, "f2", move.Result.UID)
	require.Equal(t, "", move.Result.ParentUID)

	// Fetch the folder to confirm it is now at root
	get := apis.DoRequest(helper, apis.RequestParams{
		User:   client.Args.User,
		Method: http.MethodGet,
		Path:   "/api/folders/f2",
	}, &dtos.Folder{})
	require.NotNil(t, get.Result)
	require.Equal(t, http.StatusOK, get.Response.StatusCode)
	require.Equal(t, "f2", get.Result.UID)
	require.Equal(t, "", get.Result.ParentUID)

	// Check that we can get the same folder using metadata.name selector
	results, err := client.Resource.List(context.Background(), metav1.ListOptions{
		FieldSelector: "metadata.name=" + get.Result.UID,
	})
	require.NoError(t, err)
	require.Len(t, results.Items, 1)
	require.Equal(t, "f2", results.Items[0].GetName())
}

// Test deleting nested folders ensures postorder deletion
func TestIntegrationDeleteNestedFoldersPostorder(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	for mode := 0; mode <= 5; mode++ {
		t.Run(fmt.Sprintf("Mode %d: Delete nested folder hierarchy in postorder", mode), func(t *testing.T) {
			modeDw := grafanarest.DualWriterMode(mode)
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableDataMigrations: true,
				AppModeProduction:     true,
				DisableAnonymous:      true,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
				},
				UnifiedStorageEnableSearch: true,
			})
			client := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  gvr,
			})
			// Helper function to create a folder and return its UID and ParentUID
			createFolder := func(title, uid, parentUid string) (string, string) {
				payload := fmt.Sprintf(`{"title":"%s","uid":"%s"%s}`, title, uid, func() string {
					if parentUid != "" {
						return fmt.Sprintf(`,"parentUid":"%s"`, parentUid)
					}
					return ""
				}())
				create := apis.DoRequest(helper, apis.RequestParams{
					User:   client.Args.User,
					Method: http.MethodPost,
					Path:   "/api/folders",
					Body:   []byte(payload),
				}, &folder.Folder{})
				require.NotNil(t, create.Result)
				require.Equal(t, http.StatusOK, create.Response.StatusCode)
				return create.Result.UID, create.Result.ParentUID
			}

			// Create a nested folder structure:
			//       parent
			//       /    \
			//   child1  child2
			//      |
			//  grandchild

			// Create parent folder
			parentUID, _ := createFolder(fmt.Sprintf("Parent-%d", mode), fmt.Sprintf("parent-%d", mode), "")

			// Create child1 folder
			child1UID, child1ParentUID := createFolder(fmt.Sprintf("Child1-%d", mode), fmt.Sprintf("child1-%d", mode), parentUID)
			require.Equal(t, parentUID, child1ParentUID)

			// Create child2 folder
			child2UID, child2ParentUID := createFolder(fmt.Sprintf("Child2-%d", mode), fmt.Sprintf("child2-%d", mode), parentUID)
			require.Equal(t, parentUID, child2ParentUID)

			// Create grandchild folder under child1
			grandchildUID, grandchildParentUID := createFolder(fmt.Sprintf("Grandchild-%d", mode), fmt.Sprintf("grandchild-%d", mode), child1UID)
			require.Equal(t, child1UID, grandchildParentUID)

			// Verify the structure before deletion
			verifyFolderExists := func(uid string, shouldExist bool) {
				_, err := client.Resource.Get(context.Background(), uid, metav1.GetOptions{})
				if shouldExist {
					require.NoError(t, err, "folder %s should exist", uid)
				} else {
					require.Error(t, err, "folder %s should not exist", uid)
				}
			}

			// All folders should exist
			verifyFolderExists(parentUID, true)
			verifyFolderExists(child1UID, true)
			verifyFolderExists(child2UID, true)
			verifyFolderExists(grandchildUID, true)

			// Delete the parent folder - this should trigger postorder deletion
			parentDelete := apis.DoRequest(helper, apis.RequestParams{
				User:   client.Args.User,
				Method: http.MethodDelete,
				Path:   "/api/folders/" + parentUID,
			}, &folder.Folder{})
			require.NotNil(t, parentDelete.Result)
			require.Equal(t, http.StatusOK, parentDelete.Response.StatusCode)

			// All folders should now be deleted (postorder deletion: grandchild, child1, child2, parent)
			verifyFolderExists(grandchildUID, false)
			verifyFolderExists(child1UID, false)
			verifyFolderExists(child2UID, false)
			verifyFolderExists(parentUID, false)
		})
	}
}

func setupProvisioningDir(t *testing.T, opts *testinfra.GrafanaOpts) {
	opts.Dir, opts.DirPath = testinfra.CreateGrafDir(t, *opts)

	// Create provisioning directories
	provDashboardsDir := fmt.Sprintf("%s/conf/provisioning/dashboards", opts.Dir)
	provDashboardsCfg := fmt.Sprintf("%s/dev.yaml", provDashboardsDir)
	blob := []byte(fmt.Sprintf(`
apiVersion: 1

providers:
- name: 'provisioned dashboards'
  type: file
  orgId: 1
  folder: 'GrafanaCloud'
  options:
   path: %s`, provDashboardsDir))
	err := os.WriteFile(provDashboardsCfg, blob, 0o644)
	require.NoError(t, err)
	input, err := os.ReadFile(filepath.Join("testdata/dashboard.json"))
	require.NoError(t, err)
	provDashboardFile := filepath.Join(provDashboardsDir, "dashboard.json")
	err = os.WriteFile(provDashboardFile, input, 0o644)
	require.NoError(t, err)
}

// Test deleting folder with provisioned dashboard has proper handling with forceDeleteRules
func TestIntegrationDeleteFolderWithProvisionedDashboards(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	for mode := 0; mode <= 5; mode++ {
		t.Run(fmt.Sprintf("Mode %d: Delete provisioned folders and dashboards", mode), func(t *testing.T) {
			modeDw := grafanarest.DualWriterMode(mode)
			ops := testinfra.GrafanaOpts{
				DisableDataMigrations: true,
				DisableAnonymous:      true,
				AppModeProduction:     true,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
					"dashboards.dashboard.grafana.app": {
						DualWriterMode: modeDw,
					},
				},
				UnifiedStorageEnableSearch: true,
			}

			setupProvisioningDir(t, &ops)
			helper := apis.NewK8sTestHelper(t, ops)

			client := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  gvr,
			})

			var folderUID string
			var dashboardUID string
			require.EventuallyWithT(t, func(collect *assert.CollectT) {
				resp := apis.DoRequest(helper, apis.RequestParams{
					User:   client.Args.User,
					Method: http.MethodGet,
					Path:   fmt.Sprintf("/apis/dashboard.grafana.app/v0alpha1/namespaces/%s/search?query=dashboard&limit=50&type=dashboard", client.Args.Namespace),
				}, &map[string]interface{}{})
				var list v0alpha1.SearchResults
				require.NotNil(t, resp.Response)
				assert.Equal(t, http.StatusOK, resp.Response.StatusCode)
				assert.NoError(t, json.Unmarshal(resp.Body, &list))
				assert.Equal(collect, list.TotalHits, int64(1), "Dashboard should be ready")
				for _, d := range list.Hits {
					folderUID = d.Folder
					dashboardUID = d.Name
				}
			}, 10*time.Second, 25*time.Millisecond)

			_, err := client.Resource.Get(context.Background(), folderUID, metav1.GetOptions{})
			require.NoError(t, err, "folder %s should exist", folderUID)
			// Verify dashboards exist
			verifyDashboardExists := func(shouldExist bool) {
				getDash := apis.DoRequest(helper, apis.RequestParams{
					User:   client.Args.User,
					Method: http.MethodGet,
					Path:   fmt.Sprintf("/apis/dashboard.grafana.app/v1beta1/namespaces/default/dashboards/%s", dashboardUID),
				}, &map[string]interface{}{})
				if shouldExist {
					require.Equal(t, http.StatusOK, getDash.Response.StatusCode, "dashboard %s should exist", dashboardUID)
				} else {
					require.Equal(t, http.StatusNotFound, getDash.Response.StatusCode, "dashboard %s should not exist", dashboardUID)
				}
			}

			verifyDashboardExists(true)

			t.Run("Deletion should fail when forceDeleteRules=false with provisioned dashboards", func(t *testing.T) {
				// Attempt to delete the parent folder without forceDeleteRules
				parentDeleteNoForce := apis.DoRequest(helper, apis.RequestParams{
					User:   client.Args.User,
					Method: http.MethodDelete,
					Path:   fmt.Sprintf("/api/folders/%s?forceDeleteRules=false", folderUID),
				}, &folder.Folder{})

				// Should fail because provisioned dashboards cannot be deleted without forceDeleteRules
				require.Equal(t, http.StatusBadRequest, parentDeleteNoForce.Response.StatusCode, "deletion should fail without forceDeleteRules")
				require.Contains(t, string(parentDeleteNoForce.Body), dashboards.ErrDashboardCannotDeleteProvisionedDashboard.Reason, "error message should indicate provisioned dashboards cannot be deleted")
				// Verify folders still exist
				_, err := client.Resource.Get(context.Background(), folderUID, metav1.GetOptions{})
				require.NoError(t, err, "parent folder %d should still exist", folderUID)
				// Verify dashboard still exist
				verifyDashboardExists(true)
			})

			t.Run("Deletion should succeed when forceDeleteRules=true and delete provisioned dashboards", func(t *testing.T) {
				_, err = client.Resource.Get(context.Background(), folderUID, metav1.GetOptions{})
				require.NoError(t, err, "parent folder %d should still exist", folderUID)
				// Delete the parent folder with forceDeleteRules=true
				parentDelete := apis.DoRequest(helper, apis.RequestParams{
					User:   client.Args.User,
					Method: http.MethodDelete,
					Path:   fmt.Sprintf("/api/folders/%s?forceDeleteRules=true", folderUID),
				}, &folder.Folder{})

				require.Equal(t, http.StatusOK, parentDelete.Response.StatusCode, "deletion should succeed with forceDeleteRules")

				// Verify folders was deleted
				_, err := client.Resource.Get(context.Background(), folderUID, metav1.GetOptions{})
				require.Error(t, err, "parent folder %s should not exist", folderUID)
				// Verify provisioned dashboard is deleted
				verifyDashboardExists(false)
			})
		})
	}
}

// Test that folders created during provisioning using the dual writer have the
// appropriate labels and annotations in unified storage.
func TestIntegrationProvisionedFolderPropagatesLabelsAndAnnotations(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	mode3 := grafanarest.DualWriterMode(3)
	ops := testinfra.GrafanaOpts{
		DisableDataMigrations: true,
		DisableAnonymous:      true,
		AppModeProduction:     true,
		APIServerStorageType:  "unified",
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			folders.RESOURCEGROUP: {
				DualWriterMode: mode3,
			},
			"dashboards.dashboard.grafana.app": {
				DualWriterMode: mode3,
			},
		},
		UnifiedStorageEnableSearch: true,
	}

	setupProvisioningDir(t, &ops)
	helper := apis.NewK8sTestHelper(t, ops)
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})

	var folderList folders.FolderList
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		resp := apis.DoRequest(helper, apis.RequestParams{
			User:   client.Args.User,
			Method: http.MethodGet,
			Path:   fmt.Sprintf("/apis/folder.grafana.app/v1beta1/namespaces/%s/folders", client.Args.Namespace),
		}, &map[string]interface{}{})
		require.NotNil(t, resp.Response)
		require.Equal(t, http.StatusOK, resp.Response.StatusCode)
		require.NoError(t, json.Unmarshal(resp.Body, &folderList))
	}, 10*time.Second, 25*time.Millisecond)

	require.Len(t, folderList.Items, 1)

	accessor, err := utils.MetaAccessor(&folderList.Items[0])
	require.NoError(t, err)

	expectedLabels := map[string]string{"grafana.app/deprecatedInternalID": "1"}
	expectedAnnotations := map[string]string{
		"grafana.app/createdBy": "access-policy:service",
		"grafana.app/managedBy": "classic-file-provisioning",
		"grafana.app/managerId": "provisioned dashboards",
	}

	require.Equal(t, expectedLabels, accessor.GetLabels())
	require.Equal(t, expectedAnnotations, accessor.GetAnnotations())
}

// Test finding folders with an owner
func TestIntegrationFolderSearchWithOwner(t *testing.T) {
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		DisableAnonymous:     true,
		AppModeProduction:    true,
		APIServerStorageType: "unified",
		UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
			folders.RESOURCEGROUP: {
				DualWriterMode: grafanarest.Mode5,
			},
			"dashboards.dashboard.grafana.app": {
				DualWriterMode: grafanarest.Mode5,
			},
		},
	})
	client := helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})

	// Without owner
	folder := &unstructured.Unstructured{
		Object: map[string]any{
			"spec": map[string]any{
				"title": "Folder without owner",
			},
		},
	}
	folder.SetName("folderA")
	out, err := client.Resource.Create(context.Background(), folder, metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, folder.GetName(), out.GetName())

	// with owner
	folder = &unstructured.Unstructured{
		Object: map[string]any{
			"spec": map[string]any{
				"title": "Folder with owner",
			},
		},
	}
	folder.SetName("folderB")
	folder.SetOwnerReferences([]metav1.OwnerReference{{
		APIVersion: "iam.grafana.app/v0alpha1",
		Kind:       "Team",
		Name:       "engineering",
		UID:        "123456", // required by k8s
	}, {
		APIVersion: "iam.grafana.app/v0alpha1",
		Kind:       "Team",
		Name:       "testing",
		UID:        "123457", // required by k8s
	}})
	out, err = client.Resource.Create(context.Background(), folder, metav1.CreateOptions{})
	require.NoError(t, err)
	require.Equal(t, folder.GetName(), out.GetName())

	// Get everything
	results, err := client.Resource.List(context.Background(), metav1.ListOptions{})
	require.NoError(t, err)
	require.Equal(t, []string{"folderA", "folderB"}, getNames(results.Items))

	// Verify folderB has owner references set
	folderB, err := client.Resource.Get(context.Background(), "folderB", metav1.GetOptions{})
	require.NoError(t, err)
	owners := folderB.GetOwnerReferences()
	require.Len(t, owners, 2, "folderB should have 2 owner references")
	require.Equal(t, "engineering", owners[0].Name)
	require.Equal(t, "Team", owners[0].Kind)

	// Find results with a specific owner (with trimming suffix)
	suffixToTrim := " "
	sr := callSearch(t, helper.Org1.Admin, "ownerReference=iam.grafana.app/Team/engineering"+suffixToTrim)
	require.Len(t, sr.Hits, 1)
	require.Equal(t, "folderB", sr.Hits[0].Name)

	// Do not find results if owner does not match
	sr = callSearch(t, helper.Org1.Admin, "ownerReference=iam.grafana.app/Team/marketing")
	require.Len(t, sr.Hits, 0)

	// Find results using OR conditions and search by second owner reference
	sr = callSearch(t, helper.Org1.Admin, "ownerReference=iam.grafana.app/Team/marketing&ownerReference=iam.grafana.app/Team/testing")
	require.Len(t, sr.Hits, 1)
	require.Equal(t, "folderB", sr.Hits[0].Name)
}

func getNames(items []unstructured.Unstructured) []string {
	names := make([]string, 0, len(items))
	for _, item := range items {
		names = append(names, item.GetName())
	}
	return names
}

func callSearch(t *testing.T, user apis.User, params string) *v0alpha1.SearchResults {
	require.NotNil(t, user)
	ns := user.Identity.GetNamespace()
	cfg := dynamic.ConfigFor(user.NewRestConfig())
	gv := gvr.GroupVersion()
	cfg.GroupVersion = &gv
	restClient, err := k8srest.RESTClientFor(cfg)
	require.NoError(t, err)

	var statusCode int
	req := restClient.Get().AbsPath("apis", "dashboard.grafana.app", "v0alpha1", "namespaces", ns, "search").
		Param("limit", "1000").
		Param("type", "folder")

	for kv := range strings.SplitSeq(params, "&") {
		if kv == "" {
			continue
		}
		parts := strings.SplitN(kv, "=", 2)
		if len(parts) == 2 {
			req = req.Param(parts[0], parts[1])
		}
	}
	res := req.Do(context.Background()).StatusCode(&statusCode)
	require.NoError(t, res.Error())
	require.Equal(t, http.StatusOK, statusCode)
	var sr v0alpha1.SearchResults
	raw, err := res.Raw()
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(raw, &sr))
	return &sr
}

func TestIntegrationFolderDryRun(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	if !db.IsTestDbSQLite() {
		t.Skip("test only on sqlite for now")
	}

	// Test dry-run on dual-writer modes 1-4.
	// Mode 0 (legacy-only) does not use the dualWriter, so dry-run is not intercepted.
	for mode := 1; mode <= 4; mode++ {
		modeDw := grafanarest.DualWriterMode(mode)
		t.Run(fmt.Sprintf("dry-run mode %v", modeDw), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				DisableDataMigrations: true,
				AppModeProduction:     true,
				DisableAnonymous:      true,
				APIServerStorageType:  "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					folders.RESOURCEGROUP: {
						DualWriterMode: modeDw,
					},
				},
				EnableFeatureToggles: []string{},
			})

			client := helper.GetResourceClient(apis.ResourceClientArgs{
				User: helper.Org1.Admin,
				GVR:  gvr,
			})

			// Create a real folder first
			folderObj := &unstructured.Unstructured{
				Object: map[string]any{
					"spec": map[string]any{
						"title": "DryRun Test Folder",
					},
				},
			}
			folderObj.SetGenerateName("dryrun-test-")
			created, err := client.Resource.Create(context.Background(), folderObj, metav1.CreateOptions{})
			require.NoError(t, err)
			createdName := created.GetName()
			require.NotEmpty(t, createdName)

			t.Run("delete with dry-run should not actually delete", func(t *testing.T) {
				err := client.Resource.Delete(context.Background(), createdName, metav1.DeleteOptions{
					DryRun: []string{metav1.DryRunAll},
				})
				require.NoError(t, err)

				// Folder should still exist
				got, err := client.Resource.Get(context.Background(), createdName, metav1.GetOptions{})
				require.NoError(t, err, "folder should still exist after dry-run delete")
				require.Equal(t, createdName, got.GetName())
			})

			t.Run("create with dry-run should not actually create", func(t *testing.T) {
				dryRunFolder := &unstructured.Unstructured{
					Object: map[string]any{
						"spec": map[string]any{
							"title": "DryRun Create Folder",
						},
					},
				}
				dryRunFolder.SetName("dryrun-create-test")
				_, err := client.Resource.Create(context.Background(), dryRunFolder, metav1.CreateOptions{
					DryRun: []string{metav1.DryRunAll},
				})
				require.NoError(t, err)

				// Folder should NOT exist
				_, err = client.Resource.Get(context.Background(), "dryrun-create-test", metav1.GetOptions{})
				require.Error(t, err, "folder should not exist after dry-run create")
			})

			// Update dry-run only works reliably in modes 3+ where unified storage is
			// the primary read source, so the client-sent UID matches the unified store.
			// In modes 1/2, the client reads from legacy (which has a different UID than
			// unified), causing a UID precondition mismatch on dry-run update.
			if mode >= 3 {
				t.Run("update with dry-run should not actually update", func(t *testing.T) {
					// Get the current folder
					current, err := client.Resource.Get(context.Background(), createdName, metav1.GetOptions{})
					require.NoError(t, err)

					// Modify the title
					spec := current.Object["spec"].(map[string]any)
					originalTitle := spec["title"]
					spec["title"] = "DryRun Updated Title"
					current.Object["spec"] = spec

					_, err = client.Resource.Update(context.Background(), current, metav1.UpdateOptions{
						DryRun: []string{metav1.DryRunAll},
					})
					require.NoError(t, err)

					// Title should be unchanged
					got, err := client.Resource.Get(context.Background(), createdName, metav1.GetOptions{})
					require.NoError(t, err)
					gotSpec := got.Object["spec"].(map[string]any)
					require.Equal(t, originalTitle, gotSpec["title"], "title should not change after dry-run update")
				})
			}

			// Clean up
			err = client.Resource.Delete(context.Background(), createdName, metav1.DeleteOptions{})
			require.NoError(t, err)
		})
	}
}
