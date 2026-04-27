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

func TestCreateExternalSnapshot(t *testing.T) {
	const orgID int64 = 1
	namespace := authlib.OrgNamespaceFormatter(orgID)

	testUser := &user.SignedInUser{
		UserID: 1,
		OrgID:  orgID,
	}

	t.Run("sends request to external server K8s endpoint with Bearer token", func(t *testing.T) {
		var receivedReq *http.Request
		var receivedBody map[string]any
		externalServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			receivedReq = r
			_ = json.NewDecoder(r.Body).Decode(&receivedBody)
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(dashv0.DashboardCreateResponse{
				Key:       "ext-key",
				DeleteKey: "ext-delete-key",
				URL:       "https://external.example.com/snapshots/ext-key",
				DeleteURL: "https://external.example.com/api/snapshots-delete/ext-delete-key",
			})
		}))
		defer externalServer.Close()

		options := dashv0.SnapshotSharingOptions{
			SnapshotsEnabled:      true,
			ExternalEnabled:       true,
			ExternalSnapshotURL:   externalServer.URL,
			ExternalSnapshotToken: "test-token-123",
		}

		snapshotService := dashboardsnapshots.NewMockService(t)
		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardService.On("GetDashboard", mock.Anything, &dashboards.GetDashboardQuery{
			UID:   "dash-1",
			OrgID: orgID,
		}).Return(&dashboards.Dashboard{UID: "dash-1", OrgID: orgID}, nil)

		mockStorage := grafanarest.NewMockStorage(t)
		mockStorage.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
			Return(&dashv0.Snapshot{}, nil)

		routes := GetRoutes(
			snapshotService,
			options,
			acmock.New().WithPermissions([]accesscontrol.Permission{{Action: dashboards.ActionSnapshotsCreate}}),
			map[string]common.OpenAPIDefinition{},
			func() rest.Storage { return mockStorage },
			dashboardService,
		)

		body, _ := json.Marshal(map[string]any{
			"dashboard": map[string]any{"uid": "dash-1", "title": "test"},
			"name":      "external snapshot",
			"expires":   3600,
			"external":  true,
		})

		req := httptest.NewRequest(http.MethodPost, "/snapshots/create", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), testUser))
		req = mux.SetURLVars(req, map[string]string{"namespace": namespace})

		recorder := httptest.NewRecorder()
		routes.Namespace[0].Handler(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)

		// Verify the external server received the correct request
		assert.Equal(t, "Bearer test-token-123", receivedReq.Header.Get("Authorization"))
		assert.Equal(t, "application/json", receivedReq.Header.Get("Content-Type"))
		assert.Contains(t, receivedReq.URL.Path, "/apis/dashboard.grafana.app/v0alpha1/namespaces/default/snapshots/create")
		assert.Equal(t, "external snapshot", receivedBody["name"])

		// Verify the response — URL should come from external server
		var resp dashv0.DashboardCreateResponse
		require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &resp))
		assert.Equal(t, "ext-delete-key", resp.DeleteKey)
		assert.Equal(t, "https://external.example.com/snapshots/ext-key", resp.URL)

		// Verify storage was called (local record created)
		mockStorage.AssertCalled(t, "Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("returns 502 on auth failure from external server", func(t *testing.T) {
		externalServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusForbidden)
		}))
		defer externalServer.Close()

		options := dashv0.SnapshotSharingOptions{
			SnapshotsEnabled:      true,
			ExternalEnabled:       true,
			ExternalSnapshotURL:   externalServer.URL,
			ExternalSnapshotToken: "bad-token",
		}

		snapshotService := dashboardsnapshots.NewMockService(t)
		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardService.On("GetDashboard", mock.Anything, &dashboards.GetDashboardQuery{
			UID:   "dash-1",
			OrgID: orgID,
		}).Return(&dashboards.Dashboard{UID: "dash-1", OrgID: orgID}, nil)

		routes := GetRoutes(
			snapshotService,
			options,
			acmock.New().WithPermissions([]accesscontrol.Permission{{Action: dashboards.ActionSnapshotsCreate}}),
			map[string]common.OpenAPIDefinition{},
			func() rest.Storage { return nil },
			dashboardService,
		)

		body, _ := json.Marshal(map[string]any{
			"dashboard": map[string]any{"uid": "dash-1", "title": "test"},
			"name":      "external snapshot",
			"external":  true,
		})

		req := httptest.NewRequest(http.MethodPost, "/snapshots/create", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), testUser))
		req = mux.SetURLVars(req, map[string]string{"namespace": namespace})

		recorder := httptest.NewRecorder()
		routes.Namespace[0].Handler(recorder, req)

		assert.Equal(t, http.StatusBadGateway, recorder.Code)
	})

	t.Run("returns 502 on unexpected status from external server", func(t *testing.T) {
		externalServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer externalServer.Close()

		options := dashv0.SnapshotSharingOptions{
			SnapshotsEnabled:      true,
			ExternalEnabled:       true,
			ExternalSnapshotURL:   externalServer.URL,
			ExternalSnapshotToken: "test-token",
		}

		snapshotService := dashboardsnapshots.NewMockService(t)
		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardService.On("GetDashboard", mock.Anything, &dashboards.GetDashboardQuery{
			UID:   "dash-1",
			OrgID: orgID,
		}).Return(&dashboards.Dashboard{UID: "dash-1", OrgID: orgID}, nil)

		routes := GetRoutes(
			snapshotService,
			options,
			acmock.New().WithPermissions([]accesscontrol.Permission{{Action: dashboards.ActionSnapshotsCreate}}),
			map[string]common.OpenAPIDefinition{},
			func() rest.Storage { return nil },
			dashboardService,
		)

		body, _ := json.Marshal(map[string]any{
			"dashboard": map[string]any{"uid": "dash-1", "title": "test"},
			"name":      "external snapshot",
			"external":  true,
		})

		req := httptest.NewRequest(http.MethodPost, "/snapshots/create", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), testUser))
		req = mux.SetURLVars(req, map[string]string{"namespace": namespace})

		recorder := httptest.NewRecorder()
		routes.Namespace[0].Handler(recorder, req)

		assert.Equal(t, http.StatusBadGateway, recorder.Code)
	})

	t.Run("rejects external snapshot when external is disabled", func(t *testing.T) {
		options := dashv0.SnapshotSharingOptions{
			SnapshotsEnabled: true,
			ExternalEnabled:  false,
		}

		snapshotService := dashboardsnapshots.NewMockService(t)
		dashboardService := dashboards.NewFakeDashboardService(t)
		routes := GetRoutes(
			snapshotService,
			options,
			acmock.New().WithPermissions([]accesscontrol.Permission{{Action: dashboards.ActionSnapshotsCreate}}),
			map[string]common.OpenAPIDefinition{},
			func() rest.Storage { return nil },
			dashboardService,
		)

		body, _ := json.Marshal(map[string]any{
			"dashboard": map[string]any{"uid": "dash-1", "title": "test"},
			"name":      "external snapshot",
			"external":  true,
		})

		req := httptest.NewRequest(http.MethodPost, "/snapshots/create", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), testUser))
		req = mux.SetURLVars(req, map[string]string{"namespace": namespace})

		recorder := httptest.NewRecorder()
		routes.Namespace[0].Handler(recorder, req)

		assert.Equal(t, http.StatusForbidden, recorder.Code)
	})

	t.Run("sends no Authorization header when token is empty", func(t *testing.T) {
		var receivedReq *http.Request
		externalServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			receivedReq = r
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(dashv0.DashboardCreateResponse{Key: "k"})
		}))
		defer externalServer.Close()

		options := dashv0.SnapshotSharingOptions{
			SnapshotsEnabled:      true,
			ExternalEnabled:       true,
			ExternalSnapshotURL:   externalServer.URL,
			ExternalSnapshotToken: "",
		}

		snapshotService := dashboardsnapshots.NewMockService(t)
		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardService.On("GetDashboard", mock.Anything, &dashboards.GetDashboardQuery{
			UID:   "dash-1",
			OrgID: orgID,
		}).Return(&dashboards.Dashboard{UID: "dash-1", OrgID: orgID}, nil)

		mockStorage := grafanarest.NewMockStorage(t)
		mockStorage.On("Create", mock.Anything, mock.Anything, mock.Anything, mock.Anything).
			Return(&dashv0.Snapshot{}, nil)

		routes := GetRoutes(
			snapshotService,
			options,
			acmock.New().WithPermissions([]accesscontrol.Permission{{Action: dashboards.ActionSnapshotsCreate}}),
			map[string]common.OpenAPIDefinition{},
			func() rest.Storage { return mockStorage },
			dashboardService,
		)

		body, _ := json.Marshal(map[string]any{
			"dashboard": map[string]any{"uid": "dash-1", "title": "test"},
			"external":  true,
		})

		req := httptest.NewRequest(http.MethodPost, "/snapshots/create", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req = req.WithContext(identity.WithRequester(req.Context(), testUser))
		req = mux.SetURLVars(req, map[string]string{"namespace": namespace})

		recorder := httptest.NewRecorder()
		routes.Namespace[0].Handler(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Empty(t, receivedReq.Header.Get("Authorization"))
	})
}

func TestDeleteExternalSnapshot(t *testing.T) {
	t.Run("sends DELETE request with Bearer token", func(t *testing.T) {
		var receivedReq *http.Request
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			receivedReq = r
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		err := deleteExternalSnapshot(server.URL+"/delete/mykey", "test-token")
		require.NoError(t, err)
		assert.Equal(t, http.MethodDelete, receivedReq.Method)
		assert.Equal(t, "Bearer test-token", receivedReq.Header.Get("Authorization"))
	})

	t.Run("sends no Authorization header when token is empty", func(t *testing.T) {
		var receivedReq *http.Request
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			receivedReq = r
			w.WriteHeader(http.StatusOK)
		}))
		defer server.Close()

		err := deleteExternalSnapshot(server.URL+"/delete/mykey", "")
		require.NoError(t, err)
		assert.Empty(t, receivedReq.Header.Get("Authorization"))
	})

	t.Run("returns auth error on 403", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusForbidden)
		}))
		defer server.Close()

		err := deleteExternalSnapshot(server.URL+"/delete/mykey", "bad-token")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "403")
	})

	t.Run("returns error on unexpected status", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer server.Close()

		err := deleteExternalSnapshot(server.URL+"/delete/mykey", "token")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "500")
	})
}

func TestStripSensitiveFields(t *testing.T) {
	deleteKey := "secret-key"
	dashboard := map[string]any{"uid": "dash-1", "title": "test"}

	t.Run("strips deleteKey and dashboard from snapshot", func(t *testing.T) {
		snap := &dashv0.Snapshot{
			Spec: dashv0.SnapshotSpec{
				DeleteKey: &deleteKey,
				Dashboard: dashboard,
			},
		}
		result := stripSensitiveFields(snap)
		stripped := result.(*dashv0.Snapshot)
		assert.Nil(t, stripped.Spec.DeleteKey)
		assert.Nil(t, stripped.Spec.Dashboard)
	})

	t.Run("does not modify original snapshot", func(t *testing.T) {
		snap := &dashv0.Snapshot{
			Spec: dashv0.SnapshotSpec{
				DeleteKey: &deleteKey,
				Dashboard: dashboard,
			},
		}
		_ = stripSensitiveFields(snap)
		assert.Equal(t, &deleteKey, snap.Spec.DeleteKey)
		assert.Equal(t, dashboard, snap.Spec.Dashboard)
	})

	t.Run("strips from list", func(t *testing.T) {
		list := &dashv0.SnapshotList{
			Items: []dashv0.Snapshot{
				{Spec: dashv0.SnapshotSpec{DeleteKey: &deleteKey, Dashboard: dashboard}},
				{Spec: dashv0.SnapshotSpec{DeleteKey: &deleteKey, Dashboard: dashboard}},
			},
		}
		result := stripSensitiveFieldsFromList(list)
		stripped := result.(*dashv0.SnapshotList)
		for _, item := range stripped.Items {
			assert.Nil(t, item.Spec.DeleteKey)
			assert.Nil(t, item.Spec.Dashboard)
		}
	})
}

func TestSnapshotGetAttrs(t *testing.T) {
	deleteKey := "my-delete-key"

	t.Run("returns spec.deleteKey in field set", func(t *testing.T) {
		snap := &dashv0.Snapshot{}
		snap.Name = "snap-1"
		snap.Namespace = "org-1"
		snap.Spec.DeleteKey = &deleteKey

		_, fieldSet, err := SnapshotGetAttrs(snap)
		require.NoError(t, err)
		assert.Equal(t, "my-delete-key", fieldSet.Get("spec.deleteKey"))
		assert.Equal(t, "snap-1", fieldSet.Get("metadata.name"))
	})

	t.Run("returns empty string for nil deleteKey", func(t *testing.T) {
		snap := &dashv0.Snapshot{}
		snap.Name = "snap-2"
		snap.Namespace = "org-1"

		_, fieldSet, err := SnapshotGetAttrs(snap)
		require.NoError(t, err)
		assert.Equal(t, "", fieldSet.Get("spec.deleteKey"))
	})

	t.Run("returns error for non-Snapshot object", func(t *testing.T) {
		_, _, err := SnapshotGetAttrs(&dashv0.SnapshotList{})
		require.Error(t, err)
	})
}

// testAttributes implements authorizer.Attributes for testing
type testAttributes struct {
	verb        string
	resource    string
	name        string
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
func (a *testAttributes) GetName() string         { return a.name }
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

	t.Run("denies anonymous access", func(t *testing.T) {
		auth := NewSnapshotAuthorizer(acmock.New())

		// No user in context
		decision, _, _ := auth.Authorize(context.Background(), &testAttributes{
			isResource: true,
			resource:   "snapshots",
			verb:       "create",
		})
		assert.Equal(t, authorizer.DecisionDeny, decision)
	})

	t.Run("allows anonymous get", func(t *testing.T) {
		auth := NewSnapshotAuthorizer(acmock.New())

		decision, _, err := auth.Authorize(context.Background(), &testAttributes{
			isResource: true,
			resource:   "snapshots",
			verb:       "get",
		})
		assert.NoError(t, err)
		assert.Equal(t, authorizer.DecisionAllow, decision)
	})

	t.Run("allows anonymous get dashboard subresource", func(t *testing.T) {
		auth := NewSnapshotAuthorizer(acmock.New())

		decision, _, err := auth.Authorize(context.Background(), &testAttributes{
			isResource:  true,
			resource:    "snapshots",
			verb:        "get",
			subresource: "dashboard",
		})
		assert.NoError(t, err)
		assert.Equal(t, authorizer.DecisionAllow, decision)
	})

	t.Run("denies anonymous create", func(t *testing.T) {
		auth := NewSnapshotAuthorizer(acmock.New())

		decision, _, _ := auth.Authorize(context.Background(), &testAttributes{
			isResource: true,
			resource:   "snapshots",
			verb:       "create",
		})
		assert.Equal(t, authorizer.DecisionDeny, decision)
	})

	t.Run("authenticated user with permissions can access regular create", func(t *testing.T) {
		auth := NewSnapshotAuthorizer(
			acmock.New().WithPermissions([]accesscontrol.Permission{{Action: dashboards.ActionSnapshotsCreate}}),
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

	t.Run("authenticated user can access delete/{deleteKey} custom route", func(t *testing.T) {
		auth := NewSnapshotAuthorizer(
			acmock.New().WithPermissions([]accesscontrol.Permission{{Action: dashboards.ActionSnapshotsDelete}}),
		)

		ctx := identity.WithRequester(context.Background(), testUser)
		// K8s parses snapshots/delete/{deleteKey} as name="delete", subresource="{deleteKey}"
		decision, _, err := auth.Authorize(ctx, &testAttributes{
			isResource:  true,
			resource:    "snapshots",
			verb:        "delete",
			name:        "delete",
			subresource: "randomDeleteKeyString123",
		})
		require.NoError(t, err)
		assert.Equal(t, authorizer.DecisionAllow, decision)
	})

	t.Run("denies anonymous delete/{deleteKey}", func(t *testing.T) {
		auth := NewSnapshotAuthorizer(acmock.New())

		decision, _, _ := auth.Authorize(context.Background(), &testAttributes{
			isResource:  true,
			resource:    "snapshots",
			verb:        "delete",
			name:        "delete",
			subresource: "randomDeleteKeyString123",
		})
		assert.Equal(t, authorizer.DecisionDeny, decision)
	})

	t.Run("authenticated user without permissions is denied", func(t *testing.T) {
		auth := NewSnapshotAuthorizer(
			acmock.New().WithPermissions([]accesscontrol.Permission{}),
		)

		ctx := identity.WithRequester(context.Background(), testUser)
		decision, _, _ := auth.Authorize(ctx, &testAttributes{
			isResource: true,
			resource:   "snapshots",
			verb:       "create",
			name:       "create",
		})
		assert.Equal(t, authorizer.DecisionDeny, decision)
	})
}
