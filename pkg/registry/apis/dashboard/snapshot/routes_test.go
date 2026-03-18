package snapshot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	k8suser "k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/common"

	authlib "github.com/grafana/authlib/types"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestCreateSnapshotDashboardValidation(t *testing.T) {
	const orgID int64 = 1
	namespace := authlib.OrgNamespaceFormatter(orgID)

	testUser := &user.SignedInUser{
		UserID: 1,
		OrgID:  orgID,
	}

	tests := []struct {
		name               string
		body               map[string]any
		setupDashboardMock func(*dashboards.FakeDashboardService)
		setupStorageMock   func(t *testing.T) func() rest.Storage
		expectedStatus     int
		expectedMessage    string
	}{
		{
			name: "missing dashboard UID returns 400",
			body: map[string]any{
				"dashboard": map[string]any{
					"title": "test",
				},
				"name": "test snapshot",
			},
			setupDashboardMock: func(m *dashboards.FakeDashboardService) {},
			setupStorageMock:   func(t *testing.T) func() rest.Storage { return func() rest.Storage { return nil } },
			expectedStatus:     http.StatusBadRequest,
			expectedMessage:    "dashboard UID is required",
		},
		{
			name: "empty dashboard UID returns 400",
			body: map[string]any{
				"dashboard": map[string]any{
					"uid":   "",
					"title": "test",
				},
				"name": "test snapshot",
			},
			setupDashboardMock: func(m *dashboards.FakeDashboardService) {},
			setupStorageMock:   func(t *testing.T) func() rest.Storage { return func() rest.Storage { return nil } },
			expectedStatus:     http.StatusBadRequest,
			expectedMessage:    "dashboard UID is required",
		},
		{
			name: "non-existent dashboard UID returns 400",
			body: map[string]any{
				"dashboard": map[string]any{
					"uid":   "does-not-exist",
					"title": "test",
				},
				"name": "test snapshot",
			},
			setupDashboardMock: func(m *dashboards.FakeDashboardService) {
				m.On("GetDashboard", mock.Anything, &dashboards.GetDashboardQuery{
					UID:   "does-not-exist",
					OrgID: orgID,
				}).Return(nil, dashboards.ErrDashboardNotFound)
			},
			setupStorageMock: func(t *testing.T) func() rest.Storage { return func() rest.Storage { return nil } },
			expectedStatus:   http.StatusBadRequest,
			expectedMessage:  `dashboard with UID "does-not-exist" not found`,
		},
		{
			name: "existing dashboard UID passes validation",
			body: map[string]any{
				"dashboard": map[string]any{
					"uid":   "valid-uid",
					"title": "test",
				},
				"name": "test snapshot",
			},
			setupDashboardMock: func(m *dashboards.FakeDashboardService) {
				m.On("GetDashboard", mock.Anything, &dashboards.GetDashboardQuery{
					UID:   "valid-uid",
					OrgID: orgID,
				}).Return(&dashboards.Dashboard{UID: "valid-uid", OrgID: orgID}, nil)
			},
			setupStorageMock: func(t *testing.T) func() rest.Storage {
				mockStorage := grafanarest.NewMockStorage(t)
				mockStorage.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(&dashv0.Snapshot{}, nil)
				return func() rest.Storage { return mockStorage }
			},
			expectedStatus:  http.StatusOK,
			expectedMessage: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			snapshotService := dashboardsnapshots.NewMockService(t)
			dashboardService := dashboards.NewFakeDashboardService(t)
			tt.setupDashboardMock(dashboardService)

			routes := GetRoutes(
				snapshotService,
				dashv0.SnapshotSharingOptions{SnapshotsEnabled: true},
				acmock.New().WithPermissions([]accesscontrol.Permission{{Action: dashboards.ActionSnapshotsCreate}}),
				map[string]common.OpenAPIDefinition{},
				tt.setupStorageMock(t),
				dashboardService,
			)

			// Find the create handler (first namespace route)
			require.NotEmpty(t, routes.Namespace)
			handler := routes.Namespace[0].Handler

			bodyBytes, err := json.Marshal(tt.body)
			require.NoError(t, err)

			req := httptest.NewRequest(http.MethodPost, "/snapshots/create", bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			req = req.WithContext(identity.WithRequester(req.Context(), testUser))
			req = mux.SetURLVars(req, map[string]string{"namespace": namespace})

			recorder := httptest.NewRecorder()
			handler(recorder, req)

			assert.Equal(t, tt.expectedStatus, recorder.Code)
			if tt.expectedMessage != "" {
				var resp map[string]any
				err := json.Unmarshal(recorder.Body.Bytes(), &resp)
				require.NoError(t, err)
				assert.Contains(t, fmt.Sprintf("%v", resp["message"]), tt.expectedMessage)
			}
		})
	}
}

func TestPublicCreateSnapshot(t *testing.T) {
	const orgID int64 = 1
	namespace := authlib.OrgNamespaceFormatter(orgID)

	tests := []struct {
		name             string
		body             map[string]any
		setupStorageMock func(t *testing.T) func() rest.Storage
		expectedStatus   int
		expectedMessage  string
	}{
		{
			name: "public create succeeds without auth",
			body: map[string]any{
				"dashboard": map[string]any{
					"title": "test",
				},
				"name": "test snapshot",
			},
			setupStorageMock: func(t *testing.T) func() rest.Storage {
				mockStorage := grafanarest.NewMockStorage(t)
				mockStorage.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(&dashv0.Snapshot{}, nil)
				return func() rest.Storage { return mockStorage }
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "public create does not require dashboard UID",
			body: map[string]any{
				"dashboard": map[string]any{
					"title": "no uid needed",
				},
				"name": "test snapshot",
			},
			setupStorageMock: func(t *testing.T) func() rest.Storage {
				mockStorage := grafanarest.NewMockStorage(t)
				mockStorage.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return(&dashv0.Snapshot{}, nil)
				return func() rest.Storage { return mockStorage }
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "public create rejects external snapshots",
			body: map[string]any{
				"dashboard": map[string]any{
					"title": "test",
				},
				"name":     "test snapshot",
				"external": true,
			},
			setupStorageMock: func(t *testing.T) func() rest.Storage {
				return func() rest.Storage { return nil }
			},
			expectedStatus:  http.StatusForbidden,
			expectedMessage: "External snapshots are not supported in public mode",
		},
		{
			name: "public create requires dashboard data",
			body: map[string]any{
				"name": "test snapshot",
			},
			setupStorageMock: func(t *testing.T) func() rest.Storage {
				return func() rest.Storage { return nil }
			},
			expectedStatus:  http.StatusBadRequest,
			expectedMessage: "bad request data",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			snapshotService := dashboardsnapshots.NewMockService(t)
			dashboardService := dashboards.NewFakeDashboardService(t)

			routes := GetRoutes(
				snapshotService,
				dashv0.SnapshotSharingOptions{SnapshotsEnabled: true, SnapshotPublicMode: true},
				acmock.New(), // no permissions needed for public mode
				map[string]common.OpenAPIDefinition{},
				tt.setupStorageMock(t),
				dashboardService,
			)

			// Find public-create handler
			var handler func(http.ResponseWriter, *http.Request)
			for _, route := range routes.Namespace {
				if route.Path == "snapshots/public-create" {
					handler = route.Handler
					break
				}
			}
			require.NotNil(t, handler, "public-create route not found")

			bodyBytes, err := json.Marshal(tt.body)
			require.NoError(t, err)

			// No identity in context — this is unauthenticated
			req := httptest.NewRequest(http.MethodPost, "/snapshots/public-create", bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			req = mux.SetURLVars(req, map[string]string{"namespace": namespace})

			recorder := httptest.NewRecorder()
			handler(recorder, req)

			assert.Equal(t, tt.expectedStatus, recorder.Code)
			if tt.expectedMessage != "" {
				var resp map[string]any
				err := json.Unmarshal(recorder.Body.Bytes(), &resp)
				require.NoError(t, err)
				assert.Contains(t, fmt.Sprintf("%v", resp["message"]), tt.expectedMessage)
			}
		})
	}
}

func TestPublicDeleteSnapshot(t *testing.T) {
	const orgID int64 = 1
	namespace := authlib.OrgNamespaceFormatter(orgID)

	t.Run("public delete succeeds without auth", func(t *testing.T) {
		snapshotService := dashboardsnapshots.NewMockService(t)
		snapshotService.On("GetDashboardSnapshot", mock.Anything, mock.MatchedBy(func(q *dashboardsnapshots.GetDashboardSnapshotQuery) bool {
			return q.DeleteKey == "test-delete-key"
		})).Return(&dashboardsnapshots.DashboardSnapshot{DeleteKey: "test-delete-key"}, nil)
		snapshotService.On("DeleteDashboardSnapshot", mock.Anything, mock.MatchedBy(func(cmd *dashboardsnapshots.DeleteDashboardSnapshotCommand) bool {
			return cmd.DeleteKey == "test-delete-key"
		})).Return(nil)

		dashboardService := dashboards.NewFakeDashboardService(t)

		routes := GetRoutes(
			snapshotService,
			dashv0.SnapshotSharingOptions{SnapshotsEnabled: true, SnapshotPublicMode: true},
			acmock.New(),
			map[string]common.OpenAPIDefinition{},
			func() rest.Storage { return nil },
			dashboardService,
		)

		var handler func(http.ResponseWriter, *http.Request)
		for _, route := range routes.Namespace {
			if route.Path == "snapshots/public-delete/{deleteKey}" {
				handler = route.Handler
				break
			}
		}
		require.NotNil(t, handler, "public-delete route not found")

		req := httptest.NewRequest(http.MethodDelete, "/snapshots/public-delete/test-delete-key", nil)
		req = mux.SetURLVars(req, map[string]string{"namespace": namespace, "deleteKey": "test-delete-key"})

		recorder := httptest.NewRecorder()
		handler(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		var resp map[string]any
		err := json.Unmarshal(recorder.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Contains(t, resp["message"], "Snapshot deleted")
	})
}

func TestPublicRoutesNotRegisteredWhenDisabled(t *testing.T) {
	snapshotService := dashboardsnapshots.NewMockService(t)
	dashboardService := dashboards.NewFakeDashboardService(t)

	routes := GetRoutes(
		snapshotService,
		dashv0.SnapshotSharingOptions{SnapshotsEnabled: true, SnapshotPublicMode: false},
		acmock.New(),
		map[string]common.OpenAPIDefinition{},
		func() rest.Storage { return nil },
		dashboardService,
	)

	for _, route := range routes.Namespace {
		assert.NotContains(t, route.Path, "public-create", "public-create should not be registered when public mode is disabled")
		assert.NotContains(t, route.Path, "public-delete", "public-delete should not be registered when public mode is disabled")
	}
}

// testAttributes implements authorizer.Attributes for testing
type testAttributes struct {
	verb        string
	resource    string
	subresource string
	isResource  bool
}

func (a *testAttributes) GetVerb() string         { return a.verb }
func (a *testAttributes) GetResource() string     { return a.resource }
func (a *testAttributes) GetSubresource() string  { return a.subresource }
func (a *testAttributes) IsResourceRequest() bool { return a.isResource }
func (a *testAttributes) GetAPIGroup() string     { return "" }
func (a *testAttributes) GetAPIVersion() string   { return "" }
func (a *testAttributes) GetNamespace() string    { return "" }
func (a *testAttributes) GetName() string         { return "" }
func (a *testAttributes) IsReadOnly() bool        { return false }
func (a *testAttributes) GetPath() string         { return "" }
func (a *testAttributes) GetUser() k8suser.Info   { return nil }
func (a *testAttributes) GetFieldSelector() (fields.Requirements, error) {
	return nil, nil
}
func (a *testAttributes) GetLabelSelector() (labels.Requirements, error) {
	return nil, nil
}

func TestSnapshotAuthorizer(t *testing.T) {
	testUser := &user.SignedInUser{
		UserID: 1,
		OrgID:  1,
	}

	t.Run("public mode allows anonymous access to public-create", func(t *testing.T) {
		auth := NewSnapshotAuthorizer(
			acmock.New(),
			dashv0.SnapshotSharingOptions{SnapshotPublicMode: true},
		)

		// No user in context — anonymous
		decision, _, err := auth.Authorize(context.Background(), &testAttributes{
			isResource:  true,
			resource:    "snapshots",
			subresource: "public-create",
		})
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionAllow, decision)
	})

	t.Run("public mode allows anonymous access to public-delete", func(t *testing.T) {
		auth := NewSnapshotAuthorizer(
			acmock.New(),
			dashv0.SnapshotSharingOptions{SnapshotPublicMode: true},
		)

		decision, _, err := auth.Authorize(context.Background(), &testAttributes{
			isResource:  true,
			resource:    "snapshots",
			subresource: "public-delete",
		})
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionAllow, decision)
	})

	t.Run("non-public mode denies anonymous access to public-create", func(t *testing.T) {
		auth := NewSnapshotAuthorizer(
			acmock.New(),
			dashv0.SnapshotSharingOptions{SnapshotPublicMode: false},
		)

		// No user in context
		decision, _, _ := auth.Authorize(context.Background(), &testAttributes{
			isResource:  true,
			resource:    "snapshots",
			subresource: "public-create",
		})
		assert.Equal(t, authorizer.DecisionDeny, decision)
	})

	t.Run("authenticated user with permissions can access regular create", func(t *testing.T) {
		auth := NewSnapshotAuthorizer(
			acmock.New().WithPermissions([]accesscontrol.Permission{{Action: dashboards.ActionSnapshotsCreate}}),
			dashv0.SnapshotSharingOptions{SnapshotPublicMode: false},
		)

		ctx := identity.WithRequester(context.Background(), testUser)
		decision, _, err := auth.Authorize(ctx, &testAttributes{
			isResource: true,
			resource:   "snapshots",
			verb:       "create",
		})
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionAllow, decision)
	})
}
