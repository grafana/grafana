package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestFoldersCreateAPIEndpoint(t *testing.T) {
	folderService := &foldertest.FakeService{}
	setUpRBACGuardian(t)

	folderWithoutParentInput := "{ \"uid\": \"uid\", \"title\": \"Folder\"}"

	type testCase struct {
		description            string
		expectedCode           int
		expectedFolder         *folder.Folder
		expectedFolderSvcError error
		permissions            []accesscontrol.Permission
		withNestedFolders      bool
		input                  string
	}
	tcs := []testCase{
		{
			description:    "folder creation succeeds given the correct request for creating a folder",
			input:          folderWithoutParentInput,
			expectedCode:   http.StatusOK,
			expectedFolder: &folder.Folder{UID: "uid", Title: "Folder"},
			permissions:    []accesscontrol.Permission{{Action: dashboards.ActionFoldersCreate}},
		},
		{
			description:  "folder creation fails without permissions to create a folder",
			input:        folderWithoutParentInput,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{},
		},
		{
			description:            "folder creation fails given folder service error %s",
			input:                  folderWithoutParentInput,
			expectedCode:           http.StatusConflict,
			expectedFolderSvcError: dashboards.ErrFolderWithSameUIDExists,
			permissions:            []accesscontrol.Permission{{Action: dashboards.ActionFoldersCreate}},
		},
		{
			description:            "folder creation fails given folder service error %s",
			input:                  folderWithoutParentInput,
			expectedCode:           http.StatusBadRequest,
			expectedFolderSvcError: dashboards.ErrFolderTitleEmpty,
			permissions:            []accesscontrol.Permission{{Action: dashboards.ActionFoldersCreate}},
		},
		{
			description:            "folder creation fails given folder service error %s",
			input:                  folderWithoutParentInput,
			expectedCode:           http.StatusBadRequest,
			expectedFolderSvcError: dashboards.ErrDashboardInvalidUid,
			permissions:            []accesscontrol.Permission{{Action: dashboards.ActionFoldersCreate}},
		},
		{
			description:            "folder creation fails given folder service error %s",
			input:                  folderWithoutParentInput,
			expectedCode:           http.StatusBadRequest,
			expectedFolderSvcError: dashboards.ErrDashboardUidTooLong,
			permissions:            []accesscontrol.Permission{{Action: dashboards.ActionFoldersCreate}},
		},
		{
			description:            "folder creation fails given folder service error %s",
			input:                  folderWithoutParentInput,
			expectedCode:           http.StatusConflict,
			expectedFolderSvcError: dashboards.ErrFolderSameNameExists,
			permissions:            []accesscontrol.Permission{{Action: dashboards.ActionFoldersCreate}},
		},
		{
			description:            "folder creation fails given folder service error %s",
			input:                  folderWithoutParentInput,
			expectedCode:           http.StatusForbidden,
			expectedFolderSvcError: dashboards.ErrFolderAccessDenied,
			permissions:            []accesscontrol.Permission{{Action: dashboards.ActionFoldersCreate}},
		},
		{
			description:            "folder creation fails given folder service error %s",
			input:                  folderWithoutParentInput,
			expectedCode:           http.StatusNotFound,
			expectedFolderSvcError: dashboards.ErrFolderNotFound,
			permissions:            []accesscontrol.Permission{{Action: dashboards.ActionFoldersCreate}},
		},
		{
			description:            "folder creation fails given folder service error %s",
			input:                  folderWithoutParentInput,
			expectedCode:           http.StatusPreconditionFailed,
			expectedFolderSvcError: dashboards.ErrFolderVersionMismatch,
			permissions:            []accesscontrol.Permission{{Action: dashboards.ActionFoldersCreate}},
		},
	}

	for _, tc := range tcs {
		folderService.ExpectedFolder = tc.expectedFolder
		folderService.ExpectedError = tc.expectedFolderSvcError
		folderPermService := acmock.NewMockedPermissionsService()
		folderPermService.On("SetPermissions", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return([]accesscontrol.ResourcePermission{}, nil)

		srv := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = setting.NewCfg()

			if tc.withNestedFolders {
				hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders)
			}
			hs.folderService = folderService
			hs.folderPermissionsService = folderPermService
			hs.accesscontrolService = actest.FakeService{}
		})

		t.Run(testDescription(tc.description, tc.expectedFolderSvcError), func(t *testing.T) {
			input := strings.NewReader(tc.input)
			req := srv.NewPostRequest("/api/folders", input)
			req = webtest.RequestWithSignedInUser(req, userWithPermissions(1, tc.permissions))
			resp, err := srv.SendJSON(req)
			require.NoError(t, err)
			require.Equal(t, tc.expectedCode, resp.StatusCode)

			folder := dtos.Folder{}
			err = json.NewDecoder(resp.Body).Decode(&folder)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			if tc.expectedCode == http.StatusOK {
				assert.Equal(t, "uid", folder.UID)
				assert.Equal(t, "Folder", folder.Title)
			}
		})
	}
}

func TestFoldersUpdateAPIEndpoint(t *testing.T) {
	folderService := &foldertest.FakeService{}
	setUpRBACGuardian(t)

	type testCase struct {
		description            string
		expectedCode           int
		expectedFolder         *folder.Folder
		expectedFolderSvcError error
		permissions            []accesscontrol.Permission
	}
	tcs := []testCase{
		{
			description:    "folder updating succeeds given the correct request and permissions to update a folder",
			expectedCode:   http.StatusOK,
			expectedFolder: &folder.Folder{UID: "uid", Title: "Folder upd"},
			permissions:    []accesscontrol.Permission{{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersAll}},
		},
		{
			description:  "folder updating fails without permissions to update a folder",
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{},
		},
		{
			description:            "folder updating fails given folder service error %s",
			expectedCode:           http.StatusConflict,
			expectedFolderSvcError: dashboards.ErrFolderWithSameUIDExists,
			permissions:            []accesscontrol.Permission{{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersAll}},
		},
		{
			description:            "folder updating fails given folder service error %s",
			expectedCode:           http.StatusBadRequest,
			expectedFolderSvcError: dashboards.ErrFolderTitleEmpty,
			permissions:            []accesscontrol.Permission{{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersAll}},
		},
		{
			description:            "folder updating fails given folder service error %s",
			expectedCode:           http.StatusBadRequest,
			expectedFolderSvcError: dashboards.ErrDashboardInvalidUid,
			permissions:            []accesscontrol.Permission{{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersAll}},
		},
		{
			description:            "folder updating fails given folder service error %s",
			expectedCode:           http.StatusBadRequest,
			expectedFolderSvcError: dashboards.ErrDashboardUidTooLong,
			permissions:            []accesscontrol.Permission{{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersAll}},
		},
		{
			description:            "folder updating fails given folder service error %s",
			expectedCode:           http.StatusConflict,
			expectedFolderSvcError: dashboards.ErrFolderSameNameExists,
			permissions:            []accesscontrol.Permission{{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersAll}},
		},
		{
			description:            "folder updating fails given folder service error %s",
			expectedCode:           http.StatusForbidden,
			expectedFolderSvcError: dashboards.ErrFolderAccessDenied,
			permissions:            []accesscontrol.Permission{{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersAll}},
		},
		{
			description:            "folder updating fails given folder service error %s",
			expectedCode:           http.StatusNotFound,
			expectedFolderSvcError: dashboards.ErrFolderNotFound,
			permissions:            []accesscontrol.Permission{{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersAll}},
		},
		{
			description:            "folder updating fails given folder service error %s",
			expectedCode:           http.StatusPreconditionFailed,
			expectedFolderSvcError: dashboards.ErrFolderVersionMismatch,
			permissions:            []accesscontrol.Permission{{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersAll}},
		},
	}

	for _, tc := range tcs {
		folderService.ExpectedFolder = tc.expectedFolder
		folderService.ExpectedError = tc.expectedFolderSvcError

		srv := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = setting.NewCfg()
			hs.folderService = folderService
		})

		t.Run(testDescription(tc.description, tc.expectedFolderSvcError), func(t *testing.T) {
			input := strings.NewReader("{ \"uid\": \"uid\", \"title\": \"Folder upd\" }")
			req := srv.NewRequest(http.MethodPut, "/api/folders/uid", input)
			req = webtest.RequestWithSignedInUser(req, userWithPermissions(1, tc.permissions))
			resp, err := srv.SendJSON(req)
			require.NoError(t, err)
			require.Equal(t, tc.expectedCode, resp.StatusCode)

			folder := dtos.Folder{}
			err = json.NewDecoder(resp.Body).Decode(&folder)
			require.NoError(t, err)
			require.NoError(t, resp.Body.Close())

			if tc.expectedCode == http.StatusOK {
				assert.Equal(t, "uid", folder.UID)
				assert.Equal(t, "Folder upd", folder.Title)
			}
		})
	}
}

func testDescription(description string, expectedErr error) string {
	if expectedErr != nil {
		return fmt.Sprintf(description, expectedErr.Error())
	} else {
		return description
	}
}

func TestHTTPServer_FolderMetadata(t *testing.T) {
	setUpRBACGuardian(t)
	folderService := &foldertest.FakeService{}
	features := featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders)
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.folderService = folderService
		hs.QuotaService = quotatest.New(false, nil)
		hs.SearchService = &mockSearchService{
			ExpectedResult: model.HitList{},
		}
		hs.Features = features
	})

	t.Run("Should attach access control metadata to folder response", func(t *testing.T) {
		folderService.ExpectedFolder = &folder.Folder{UID: "folderUid"}

		req := server.NewGetRequest("/api/folders/folderUid?accesscontrol=true")
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{
			1: accesscontrol.GroupScopesByActionContext(context.Background(), []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersAll},
				{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID("folderUid")},
			}),
		}})

		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		defer func() { require.NoError(t, res.Body.Close()) }()

		body := dtos.Folder{}
		require.NoError(t, json.NewDecoder(res.Body).Decode(&body))

		assert.True(t, body.AccessControl[dashboards.ActionFoldersRead])
		assert.True(t, body.AccessControl[dashboards.ActionFoldersWrite])
	})

	t.Run("Should attach access control metadata to folder response with permissions cascading from nested folders", func(t *testing.T) {
		folderService.ExpectedFolder = &folder.Folder{UID: "folderUid"}
		folderService.ExpectedFolders = []*folder.Folder{{UID: "parentUid"}}
		features = featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders)
		defer func() {
			features = featuremgmt.WithFeatures()
			folderService.ExpectedFolders = nil
		}()

		req := server.NewGetRequest("/api/folders/folderUid?accesscontrol=true")
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{
			1: accesscontrol.GroupScopesByActionContext(context.Background(), []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersAll},
				{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID("parentUid")},
				{Action: dashboards.ActionDashboardsCreate, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID("folderUid")},
			}),
		}})

		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		defer func() { require.NoError(t, res.Body.Close()) }()

		body := dtos.Folder{}
		require.NoError(t, json.NewDecoder(res.Body).Decode(&body))

		assert.True(t, body.AccessControl[dashboards.ActionFoldersRead])
		assert.True(t, body.AccessControl[dashboards.ActionFoldersWrite])
		assert.True(t, body.AccessControl[dashboards.ActionDashboardsCreate])
	})

	t.Run("Should not attach access control metadata to folder response", func(t *testing.T) {
		folderService.ExpectedFolder = &folder.Folder{UID: "folderUid"}

		req := server.NewGetRequest("/api/folders/folderUid")
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{UserID: 1, OrgID: 1, Permissions: map[int64]map[string][]string{
			1: accesscontrol.GroupScopesByActionContext(context.Background(), []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersAll},
				{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID("folderUid")},
			}),
		}})

		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		defer func() { require.NoError(t, res.Body.Close()) }()

		body := dtos.Folder{}
		require.NoError(t, json.NewDecoder(res.Body).Decode(&body))

		assert.False(t, body.AccessControl[dashboards.ActionFoldersRead])
		assert.False(t, body.AccessControl[dashboards.ActionFoldersWrite])
	})
}

func TestFolderMoveAPIEndpoint(t *testing.T) {
	folderService := &foldertest.FakeService{
		ExpectedFolder: &folder.Folder{},
	}
	setUpRBACGuardian(t)

	type testCase struct {
		description  string
		expectedCode int
		permissions  []accesscontrol.Permission
		newParentUid string
	}
	tcs := []testCase{
		{
			description:  "can move folder to another folder with specific permissions",
			newParentUid: "newParentUid",
			expectedCode: http.StatusOK,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID("uid")},
				{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID("newParentUid")},
			},
		},
		{
			description:  "can move folder to the root folder with specific permissions",
			newParentUid: "",
			expectedCode: http.StatusOK,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID("uid")},
			},
		},
		{
			description:  "forbidden to move folder to another folder without the write access on the folder being moved",
			newParentUid: "newParentUid",
			expectedCode: http.StatusForbidden,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersWrite, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID("newParentUid")},
			},
		},
	}

	for _, tc := range tcs {
		srv := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = setting.NewCfg()
			hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders)
			hs.folderService = folderService
		})

		t.Run(tc.description, func(t *testing.T) {
			input := strings.NewReader(fmt.Sprintf("{ \"parentUid\": \"%s\"}", tc.newParentUid))
			req := srv.NewRequest(http.MethodPost, "/api/folders/uid/move", input)
			req = webtest.RequestWithSignedInUser(req, userWithPermissions(1, tc.permissions))
			resp, err := srv.SendJSON(req)
			require.NoError(t, err)
			require.Equal(t, tc.expectedCode, resp.StatusCode)
			require.NoError(t, resp.Body.Close())
		})
	}
}

func TestFolderGetAPIEndpoint(t *testing.T) {
	folderService := &foldertest.FakeService{
		ExpectedFolder: &folder.Folder{
			UID:   "uid",
			Title: "uid title",
		},
		ExpectedFolders: []*folder.Folder{
			{
				UID:   "parent",
				Title: "parent title",
			},
			{
				UID:   "subfolder",
				Title: "subfolder title",
			},
		},
	}

	type testCase struct {
		description          string
		URL                  string
		features             featuremgmt.FeatureToggles
		expectedCode         int
		expectedParentUIDs   []string
		expectedParentOrgIDs []int64
		expectedParentTitles []string
		permissions          []accesscontrol.Permission
		g                    *guardian.FakeDashboardGuardian
	}
	tcs := []testCase{
		{
			description:          "get folder by UID should return parent folders if nested folder are enabled",
			URL:                  "/api/folders/uid",
			expectedCode:         http.StatusOK,
			features:             featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders),
			expectedParentUIDs:   []string{"parent", "subfolder"},
			expectedParentOrgIDs: []int64{0, 0},
			expectedParentTitles: []string{"parent title", "subfolder title"},
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID("uid")},
			},
			g: &guardian.FakeDashboardGuardian{CanViewValue: true},
		},
		{
			description:          "get folder by UID should return parent folders redacted if nested folder are enabled and user does not have read access to parent folders",
			URL:                  "/api/folders/uid",
			expectedCode:         http.StatusOK,
			features:             featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders),
			expectedParentUIDs:   []string{REDACTED, REDACTED},
			expectedParentOrgIDs: []int64{0, 0},
			expectedParentTitles: []string{REDACTED, REDACTED},
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID("uid")},
			},
			g: &guardian.FakeDashboardGuardian{CanViewValue: false},
		},
		{
			description:          "get folder by UID should not return parent folders if nested folder are disabled",
			URL:                  "/api/folders/uid",
			expectedCode:         http.StatusOK,
			features:             featuremgmt.WithFeatures(),
			expectedParentUIDs:   []string{},
			expectedParentOrgIDs: []int64{0, 0},
			expectedParentTitles: []string{},
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID("uid")},
			},
			g: &guardian.FakeDashboardGuardian{CanViewValue: true},
		},
	}

	for _, tc := range tcs {
		srv := SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = setting.NewCfg()
			hs.Features = tc.features
			hs.folderService = folderService
		})

		t.Run(tc.description, func(t *testing.T) {
			origNewGuardian := guardian.New
			t.Cleanup(func() {
				guardian.New = origNewGuardian
			})

			guardian.MockDashboardGuardian(tc.g)

			req := srv.NewGetRequest(tc.URL)
			req = webtest.RequestWithSignedInUser(req, userWithPermissions(1, tc.permissions))
			resp, err := srv.Send(req)
			require.NoError(t, err)
			require.Equal(t, tc.expectedCode, resp.StatusCode)

			folder := dtos.Folder{}
			err = json.NewDecoder(resp.Body).Decode(&folder)
			require.NoError(t, err)

			require.Equal(t, len(folder.Parents), len(tc.expectedParentUIDs))
			require.Equal(t, len(folder.Parents), len(tc.expectedParentTitles))

			for i := 0; i < len(tc.expectedParentUIDs); i++ {
				assert.Equal(t, tc.expectedParentUIDs[i], folder.Parents[i].UID)
				assert.Equal(t, tc.expectedParentOrgIDs[i], folder.Parents[i].OrgID)
				assert.Equal(t, tc.expectedParentTitles[i], folder.Parents[i].Title)
			}
			require.NoError(t, resp.Body.Close())
		})
	}
}
