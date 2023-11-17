package api

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/annotationstest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestAPI_Annotations(t *testing.T) {
	dashUID := "test-dash"
	folderUID := "test-folder"

	type testCase struct {
		desc         string
		path         string
		method       string
		body         string
		expectedCode int
		featureFlags []any
		permissions  []accesscontrol.Permission
	}

	tests := []testCase{
		{
			desc:         "should be able to fetch annotations with correct permission",
			path:         "/api/annotations",
			method:       http.MethodGet,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsRead, Scope: accesscontrol.ScopeAnnotationsAll}},
		},
		{
			desc:         "should not be able to fetch annotations without correct permission",
			path:         "/api/annotations",
			method:       http.MethodGet,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{},
		},
		{
			desc:         "should be able to fetch annotation by id with correct permission",
			path:         "/api/annotations/1",
			method:       http.MethodGet,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsRead, Scope: accesscontrol.ScopeAnnotationsAll}},
		},
		{
			desc:         "should not be able to fetch annotation by id without correct permission",
			path:         "/api/annotations/1",
			method:       http.MethodGet,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{},
		},
		{
			desc:         "should be able to fetch dashboard annotation by id with correct dashboard scope with annotationPermissionUpdate enabled",
			path:         "/api/annotations/2",
			featureFlags: []any{featuremgmt.FlagAnnotationPermissionUpdate},
			method:       http.MethodGet,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsRead, Scope: dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dashUID)}},
		},
		{
			desc:         "should be able to fetch dashboard annotation by id with correct folder scope with annotationPermissionUpdate enabled",
			path:         "/api/annotations/2",
			featureFlags: []any{featuremgmt.FlagAnnotationPermissionUpdate},
			method:       http.MethodGet,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsRead, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID)}},
		},
		{
			desc:         "should not be able to fetch dashboard annotation by id with the old dashboard scope when annotationPermissionUpdate enabled",
			path:         "/api/annotations/2",
			featureFlags: []any{featuremgmt.FlagAnnotationPermissionUpdate},
			method:       http.MethodGet,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsRead, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should be able to fetch annotation tags with correct permission",
			path:         "/api/annotations/tags",
			method:       http.MethodGet,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsRead}},
		},
		{
			desc:         "should not be able to fetch annotation tags without correct permission",
			path:         "/api/annotations/tags",
			method:       http.MethodGet,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{},
		},
		{
			desc:         "should be able to update dashboard annotation with correct permission",
			path:         "/api/annotations/2",
			method:       http.MethodPut,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should not be able to update dashboard annotation without correct permission",
			path:         "/api/annotations/2",
			method:       http.MethodPut,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{},
		},
		{
			desc:         "should be able to update dashboard annotation with correct dashboard scope with annotationPermissionUpdate enabled",
			path:         "/api/annotations/2",
			featureFlags: []any{featuremgmt.FlagAnnotationPermissionUpdate},
			method:       http.MethodPut,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dashUID)}},
		},
		{
			desc:         "should be able to update dashboard annotation with correct folder scope with annotationPermissionUpdate enabled",
			path:         "/api/annotations/2",
			featureFlags: []any{featuremgmt.FlagAnnotationPermissionUpdate},
			method:       http.MethodPut,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID)}},
		},
		{
			desc:         "should not be able to update dashboard annotation with the old dashboard scope when annotationPermissionUpdate enabled",
			path:         "/api/annotations/2",
			featureFlags: []any{featuremgmt.FlagAnnotationPermissionUpdate},
			method:       http.MethodPut,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should be able to update organization annotation with correct permission",
			path:         "/api/annotations/1",
			method:       http.MethodPut,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
		},
		{
			desc:         "should not be able to update organization annotation without correct permission",
			path:         "/api/annotations/1",
			method:       http.MethodPut,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should be able to patch dashboard annotation with correct permission",
			path:         "/api/annotations/2",
			method:       http.MethodPatch,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should not be able to patch dashboard annotation without correct permission",
			path:         "/api/annotations/2",
			method:       http.MethodPatch,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{},
		},
		{
			desc:         "should be able to patch dashboard annotation with correct dashboard scope with annotationPermissionUpdate enabled",
			path:         "/api/annotations/2",
			featureFlags: []any{featuremgmt.FlagAnnotationPermissionUpdate},
			method:       http.MethodPatch,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dashUID)}},
		},
		{
			desc:         "should be able to patch dashboard annotation with correct folder scope with annotationPermissionUpdate enabled",
			path:         "/api/annotations/2",
			featureFlags: []any{featuremgmt.FlagAnnotationPermissionUpdate},
			method:       http.MethodPatch,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID)}},
		},
		{
			desc:         "should not be able to patch dashboard annotation with the old dashboard scope when annotationPermissionUpdate enabled",
			path:         "/api/annotations/2",
			featureFlags: []any{featuremgmt.FlagAnnotationPermissionUpdate},
			method:       http.MethodPatch,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should be able to patch organization annotation with correct permission",
			path:         "/api/annotations/1",
			method:       http.MethodPatch,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
		},
		{
			desc:         "should not be able to patch organization annotation without correct permission",
			path:         "/api/annotations/1",
			method:       http.MethodPatch,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsWrite, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should be able to create dashboard annotation with correct permission",
			path:         "/api/annotations",
			method:       http.MethodPost,
			body:         "{\"dashboardId\": 2,\"text\": \"test\"}",
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should not be able to create dashboard annotation without correct permission",
			path:         "/api/annotations",
			method:       http.MethodPost,
			body:         "{\"dashboardId\": 2,\"text\": \"test\"}",
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
		},
		{
			desc:         "should be able to create dashboard annotation with correct dashboard scope with annotationPermissionUpdate enabled",
			path:         "/api/annotations",
			method:       http.MethodPost,
			body:         "{\"dashboardId\": 2,\"text\": \"test\"}",
			featureFlags: []any{featuremgmt.FlagAnnotationPermissionUpdate},
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsCreate, Scope: dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dashUID)}},
		},
		{
			desc:         "should be able to create dashboard annotation with correct folder scope with annotationPermissionUpdate enabled",
			path:         "/api/annotations",
			method:       http.MethodPost,
			body:         "{\"dashboardId\": 2,\"text\": \"test\"}",
			featureFlags: []any{featuremgmt.FlagAnnotationPermissionUpdate},
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsCreate, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID)}},
		},
		{
			desc:         "should not be able to create dashboard annotation with the old dashboard scope when annotationPermissionUpdate enabled",
			path:         "/api/annotations",
			method:       http.MethodPost,
			body:         "{\"dashboardId\": 2,\"text\": \"test\"}",
			featureFlags: []any{featuremgmt.FlagAnnotationPermissionUpdate},
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should be able to create organization annotation with correct permission",
			path:         "/api/annotations",
			method:       http.MethodPost,
			body:         "{\"text\": \"test\"}",
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
		},
		{
			desc:         "should not be able to create organization annotation without correct permission",
			path:         "/api/annotations",
			method:       http.MethodPost,
			body:         "{\"text\": \"test\"}",
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should be able to delete dashboard annotation with correct permission",
			path:         "/api/annotations/2",
			method:       http.MethodDelete,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should not be able to delete dashboard annotation without correct permission",
			path:         "/api/annotations/2",
			method:       http.MethodDelete,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
		},
		{
			desc:         "should be able to delete dashboard annotation with correct dashboard scope with annotationPermissionUpdate enabled",
			path:         "/api/annotations/2",
			featureFlags: []any{featuremgmt.FlagAnnotationPermissionUpdate},
			method:       http.MethodDelete,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dashUID)}},
		},
		{
			desc:         "should be able to delete dashboard annotation with correct folder scope with annotationPermissionUpdate enabled",
			path:         "/api/annotations/2",
			featureFlags: []any{featuremgmt.FlagAnnotationPermissionUpdate},
			method:       http.MethodDelete,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID)}},
		},
		{
			desc:         "should not be able to delete dashboard annotation with the old dashboard scope when annotationPermissionUpdate enabled",
			path:         "/api/annotations/2",
			featureFlags: []any{featuremgmt.FlagAnnotationPermissionUpdate},
			method:       http.MethodDelete,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should be able to delete organization annotation with correct permission",
			path:         "/api/annotations/1",
			method:       http.MethodDelete,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
		},
		{
			desc:         "should not be able to delete organization annotation without correct permission",
			path:         "/api/annotations/1",
			method:       http.MethodDelete,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should be able to create graphite annotation with correct permission",
			path:         "/api/annotations/graphite",
			body:         "{\"what\": \"test\", \"tags\": []}",
			method:       http.MethodPost,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
		},
		{
			desc:         "should not be able to create graphite annotation without correct permission",
			path:         "/api/annotations/graphite",
			method:       http.MethodPost,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsCreate, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should be able to mass delete dashboard annotations with correct permission",
			path:         "/api/annotations/mass-delete",
			body:         "{\"dashboardId\": 2, \"panelId\": 1}",
			method:       http.MethodPost,
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
		{
			desc:         "should not be able to mass delete dashboard annotations without correct permission",
			path:         "/api/annotations/mass-delete",
			body:         "{\"dashboardId\": 2, \"panelId\": 1}",
			method:       http.MethodPost,
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeOrganization}},
		},
		{
			desc:         "should be able to mass delete dashboard annotation with correct dashboard scope with annotationPermissionUpdate enabled",
			path:         "/api/annotations/mass-delete",
			body:         "{\"dashboardId\": 2, \"panelId\": 1}",
			method:       http.MethodPost,
			featureFlags: []any{featuremgmt.FlagAnnotationPermissionUpdate},
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dashUID)}},
		},
		{
			desc:         "should be able to mass delete dashboard annotation with correct folder scope with annotationPermissionUpdate enabled",
			path:         "/api/annotations/mass-delete",
			body:         "{\"dashboardId\": 2, \"panelId\": 1}",
			method:       http.MethodPost,
			featureFlags: []any{featuremgmt.FlagAnnotationPermissionUpdate},
			expectedCode: http.StatusOK,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID(folderUID)}},
		},
		{
			desc:         "should not be able to mass delete dashboard annotation with the old dashboard scope when annotationPermissionUpdate enabled",
			path:         "/api/annotations/mass-delete",
			body:         "{\"dashboardId\": 2, \"panelId\": 1}",
			method:       http.MethodPost,
			featureFlags: []any{featuremgmt.FlagAnnotationPermissionUpdate},
			expectedCode: http.StatusForbidden,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionAnnotationsDelete, Scope: accesscontrol.ScopeAnnotationsTypeDashboard}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			// Don't need access to dashboards if annotationPermissionUpdate is enabled
			if len(tt.featureFlags) == 0 {
				setUpRBACGuardian(t)
			}
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				repo := annotationstest.NewFakeAnnotationsRepo()
				_ = repo.Save(context.Background(), &annotations.Item{ID: 1, DashboardID: 0})
				_ = repo.Save(context.Background(), &annotations.Item{ID: 2, DashboardID: 1})
				hs.annotationsRepo = repo
				hs.AccessControl = acimpl.ProvideAccessControl(hs.Cfg)
				hs.AccessControl.RegisterScopeAttributeResolver(AnnotationTypeScopeResolver(hs.annotationsRepo))
				hs.Features = featuremgmt.WithFeatures(tt.featureFlags...)
				dashService := &dashboards.FakeDashboardService{}
				dashService.On("GetDashboard", mock.Anything, mock.Anything).Return(&dashboards.Dashboard{UID: dashUID, FolderUID: folderUID}, nil)
				folderService := &foldertest.FakeService{}
				folderService.ExpectedFolder = &folder.Folder{UID: folderUID}
				hs.DashboardService = dashService
				hs.folderService = folderService
			})
			var body io.Reader
			if tt.body != "" {
				body = strings.NewReader(tt.body)
			}

			req := webtest.RequestWithSignedInUser(server.NewRequest(tt.method, tt.path, body), authedUserWithPermissions(1, 1, tt.permissions))
			res, err := server.SendJSON(req)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}
func TestService_AnnotationTypeScopeResolver(t *testing.T) {
	type testCaseResolver struct {
		desc    string
		given   string
		want    string
		wantErr error
	}

	testCases := []testCaseResolver{
		{
			desc:    "correctly resolves dashboard annotations",
			given:   "annotations:id:1",
			want:    accesscontrol.ScopeAnnotationsTypeDashboard,
			wantErr: nil,
		},
		{
			desc:    "correctly resolves organization annotations",
			given:   "annotations:id:2",
			want:    accesscontrol.ScopeAnnotationsTypeOrganization,
			wantErr: nil,
		},
		{
			desc:    "invalid annotation ID",
			given:   "annotations:id:123abc",
			want:    "",
			wantErr: accesscontrol.ErrInvalidScope,
		},
		{
			desc:    "malformed scope",
			given:   "annotations:1",
			want:    "",
			wantErr: accesscontrol.ErrInvalidScope,
		},
	}

	dashboardAnnotation := annotations.Item{ID: 1, DashboardID: 1}
	organizationAnnotation := annotations.Item{ID: 2}

	fakeAnnoRepo := annotationstest.NewFakeAnnotationsRepo()
	_ = fakeAnnoRepo.Save(context.Background(), &dashboardAnnotation)
	_ = fakeAnnoRepo.Save(context.Background(), &organizationAnnotation)

	prefix, resolver := AnnotationTypeScopeResolver(fakeAnnoRepo)
	require.Equal(t, "annotations:id:", prefix)

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			resolved, err := resolver.Resolve(context.Background(), 1, tc.given)
			if tc.wantErr != nil {
				require.Error(t, err)
				require.Equal(t, tc.wantErr, err)
			} else {
				require.NoError(t, err)
				require.Len(t, resolved, 1)
				require.Equal(t, tc.want, resolved[0])
			}
		})
	}
}

func setUpRBACGuardian(t *testing.T) {
	origNewGuardian := guardian.New
	t.Cleanup(func() {
		guardian.New = origNewGuardian
	})

	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanEditValue: true, CanViewValue: true})
}
