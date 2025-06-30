package libraryelements

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestUnstructuredToLegacyLibraryPanelDTO(t *testing.T) {
	cfg := setting.NewCfg()
	userSvc := &usertest.FakeUserService{}
	testUser := &user.User{
		ID:    1,
		UID:   "test-user-uid",
		Login: "testuser",
		Email: "test@example.com",
	}
	userSvc.ExpectedListUsersByIdOrUid = []*user.User{testUser}

	testFolder := &folder.Folder{
		ID:    1,
		UID:   "test-folder-uid",
		Title: "Test Folder",
	}
	folderSvc := &foldertest.FakeService{
		ExpectedFolder: testFolder,
	}

	dashboardsSvc := &dashboards.FakeDashboardService{}
	testDashboard := &dashboards.DashboardRef{
		ID:        1,
		UID:       "test-dashboard-uid",
		FolderUID: testFolder.UID,
	}
	dashboardsSvc.On("GetDashboardsByLibraryPanelUID", mock.Anything, "test-panel-uid", int64(1)).Return([]*dashboards.DashboardRef{testDashboard}, nil)

	handler := &libraryElementsK8sHandler{
		cfg:               cfg,
		folderService:     folderSvc,
		dashboardsService: dashboardsSvc,
		userService:       userSvc,
	}

	unstructuredObj := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "dashboard.grafana.app/v0alpha1",
			"kind":       "LibraryPanel",
			"metadata": map[string]any{
				"name": "test-panel-uid",
			},
			"spec": map[string]any{
				"type":          "text",
				"pluginVersion": "1.0.0",
				"title":         "Test Library Panel",
				"panelTitle":    "Test Panel Title",
				"description":   "Test description",
				"options": map[string]interface{}{
					"content": "Test content",
				},
				"fieldConfig": map[string]interface{}{
					"defaults": map[string]interface{}{
						"color": map[string]interface{}{
							"mode": "palette-classic",
						},
					},
				},
				"gridPos": map[string]interface{}{
					"h": 8,
					"w": 12,
					"x": 0,
					"y": 0,
				},
				"datasource": map[string]interface{}{
					"type": "testdata",
					"uid":  "test-datasource",
				},
				"transparent": true,
				"links": []interface{}{
					map[string]interface{}{
						"title": "Test Link",
						"url":   "https://example.com",
					},
				},
				"targets": []interface{}{
					map[string]interface{}{
						"refId": "A",
						"expr":  "test_query",
					},
				},
			},
		},
	}

	meta, err := utils.MetaAccessor(unstructuredObj)
	require.NoError(t, err)
	meta.SetFolder(testFolder.UID)
	meta.SetGeneration(2)
	creationTimestamp := metav1.NewTime(time.Now())
	meta.SetCreationTimestamp(creationTimestamp)
	meta.SetCreatedBy(testUser.UID)
	meta.SetDeprecatedInternalID(123) // nolint:staticcheck

	reqContext := &contextmodel.ReqContext{
		Context: &web.Context{
			Req: httptest.NewRequest("GET", "/", nil).WithContext(context.Background()),
		},
		SignedInUser: &user.SignedInUser{
			UserID:  1,
			OrgID:   1,
			OrgRole: org.RoleAdmin,
		},
	}
	result, err := handler.unstructuredToLegacyLibraryPanelDTO(reqContext, *unstructuredObj)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, int64(123), result.ID)
	require.Equal(t, int64(1), result.OrgID)
	require.Equal(t, testFolder.UID, result.FolderUID)
	require.Equal(t, "test-panel-uid", result.UID)
	require.Equal(t, "Test Library Panel", result.Name)
	require.Equal(t, int64(model.PanelElement), result.Kind)
	require.Equal(t, "text", result.Type)
	require.Equal(t, "Test description", result.Description)
	require.Equal(t, int64(2), result.Version)
	require.Equal(t, testFolder.UID, result.Meta.FolderUID)
	require.Equal(t, testFolder.Title, result.Meta.FolderName)
	require.Equal(t, int64(1), result.Meta.ConnectedDashboards)
	require.Equal(t, int64(1), result.FolderID) // nolint:staticcheck
	require.Equal(t, creationTimestamp.Format(time.RFC3339), result.Meta.Created.Format(time.RFC3339))
	require.Equal(t, testUser.ID, result.Meta.CreatedBy.Id)
	require.Equal(t, testUser.Login, result.Meta.CreatedBy.Name)
	require.Equal(t, dtos.GetGravatarUrl(cfg, testUser.Email), result.Meta.CreatedBy.AvatarUrl)
	require.Equal(t, creationTimestamp.Format(time.RFC3339), result.Meta.Updated.Format(time.RFC3339))
	require.Equal(t, testUser.ID, result.Meta.UpdatedBy.Id)
	require.Equal(t, testUser.Login, result.Meta.UpdatedBy.Name)
	require.Equal(t, dtos.GetGravatarUrl(cfg, testUser.Email), result.Meta.UpdatedBy.AvatarUrl)

	var modelMap map[string]interface{}
	err = json.Unmarshal(result.Model, &modelMap)
	require.NoError(t, err)
	require.Equal(t, "testdata", modelMap["datasource"].(map[string]interface{})["type"])
	require.Equal(t, "test-datasource", modelMap["datasource"].(map[string]interface{})["uid"])
	require.Equal(t, "Test description", modelMap["description"])
	require.Equal(t, float64(123), modelMap["id"])
	require.Equal(t, "text", modelMap["type"])
	require.Equal(t, "Test Panel Title", modelMap["title"])
	require.Equal(t, "Test content", modelMap["options"].(map[string]interface{})["content"])
	require.Equal(t, true, modelMap["transparent"])
	require.Equal(t, "Test Library Panel", modelMap["libraryPanel"].(map[string]interface{})["name"])
	require.Equal(t, "test-panel-uid", modelMap["libraryPanel"].(map[string]interface{})["uid"])
	links := modelMap["links"].([]interface{})
	require.Len(t, links, 1)
	require.Equal(t, "Test Link", links[0].(map[string]interface{})["title"])

	targets := modelMap["targets"].([]interface{})
	require.Len(t, targets, 1)
	require.Equal(t, "A", targets[0].(map[string]interface{})["refId"])

	dashboardsSvc.AssertExpectations(t)
}
