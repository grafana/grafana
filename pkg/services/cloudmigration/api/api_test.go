package api

import (
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/cloudmigration/cloudmigrationimpl/fake"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web/webtest"
	"github.com/stretchr/testify/require"
)

type TestCase struct {
	desc              string
	requestHttpMethod string
	requestUrl        string
	requestBody       string
	user              *user.SignedInUser
	// if the CloudMigrationService should return an error
	serviceReturnError bool
	expectedHttpResult int
	expectedBody       string
}

var (
	orgID int64 = 1

	userWithPermissions = &user.SignedInUser{
		OrgID:   orgID,
		OrgRole: org.RoleEditor,
		Permissions: map[int64]map[string][]string{
			orgID: {cloudmigration.ActionMigrate: nil},
		},
	}

	userWithoutPermissions = &user.SignedInUser{
		OrgID:          orgID,
		OrgRole:        org.RoleAdmin,
		IsGrafanaAdmin: true,
		Permissions:    map[int64]map[string][]string{},
	}
)

func TestCloudMigrationAPI_GetToken(t *testing.T) {
	tests := []TestCase{
		{
			desc:               "returns 200 if the user has the right permissions",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/token",
			user:               userWithPermissions,
			expectedHttpResult: http.StatusOK,
			expectedBody:       `{"id":"mock_id","displayName":"mock_name","expiresAt":"","firstUsedAt":"","lastUsedAt":"","createdAt":""}`,
		},
		{
			desc:               "returns 403 if the user does not have the right permissions",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/token",
			user:               userWithoutPermissions,
			expectedHttpResult: http.StatusForbidden,
			expectedBody:       "",
		},
		{
			desc:               "returns 500 if service returns an error",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/token",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusInternalServerError,
			expectedBody:       "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, runSimpleApiTest(tt))
	}
}

func TestCloudMigrationAPI_CreateToken(t *testing.T) {
	tests := []TestCase{
		{
			desc:               "returns 200 if the user has the right permissions",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/token",
			user:               userWithPermissions,
			expectedHttpResult: http.StatusOK,
			expectedBody:       `{"token":"mock_token"}`,
		},
		{
			desc:               "returns 403 if the user does not have the right permissions",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/token",
			user:               userWithoutPermissions,
			expectedHttpResult: http.StatusForbidden,
			expectedBody:       "",
		},
		{
			desc:               "returns 500 if service returns an error",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/token",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusInternalServerError,
			expectedBody:       "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, runSimpleApiTest(tt))
	}
}

func TestCloudMigrationAPI_DeleteToken(t *testing.T) {
	tests := []TestCase{
		{
			desc:               "returns 200 if the user has the right permissions",
			requestHttpMethod:  http.MethodDelete,
			requestUrl:         "/api/cloudmigration/token/1234",
			user:               userWithPermissions,
			expectedHttpResult: http.StatusNoContent,
		},
		{
			desc:               "returns 403 if the user does not have the right permissions",
			requestHttpMethod:  http.MethodDelete,
			requestUrl:         "/api/cloudmigration/token/1234",
			user:               userWithoutPermissions,
			expectedHttpResult: http.StatusForbidden,
		},
		{
			desc:               "returns 500 if service returns an error",
			requestHttpMethod:  http.MethodDelete,
			requestUrl:         "/api/cloudmigration/token/1234",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusInternalServerError,
		},
		{
			desc:               "returns 400 if uid is invalid",
			requestHttpMethod:  http.MethodDelete,
			requestUrl:         "/api/cloudmigration/token/***",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, runSimpleApiTest(tt))
	}
}

func TestCloudMigrationAPI_GetMigration(t *testing.T) {
	tests := []TestCase{
		{
			desc:               "returns 200 if the user has the right permissions",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/1234",
			user:               userWithPermissions,
			expectedHttpResult: http.StatusOK,
		},
		{
			desc:               "returns 403 if the user does not have the right permissions",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/1234",
			user:               userWithoutPermissions,
			expectedHttpResult: http.StatusForbidden,
		},
		{
			desc:               "returns 500 if service returns an error",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/1234",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusNotFound,
		},
		{
			desc:               "returns 400 if uid is invalid",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/****",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, runSimpleApiTest(tt))
	}
}

func TestCloudMigrationAPI_GetMigrationList(t *testing.T) {
	tests := []TestCase{
		{
			desc:               "returns 200 if the user has the right permissions",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration",
			user:               userWithPermissions,
			expectedHttpResult: http.StatusOK,
			expectedBody:       `{"sessions":[{"uid":"mock_uid_1","slug":"mock_stack_1","created":"2024-06-05T17:30:40Z","updated":"2024-06-05T17:30:40Z"},{"uid":"mock_uid_2","slug":"mock_stack_2","created":"2024-06-05T17:30:40Z","updated":"2024-06-05T17:30:40Z"}]}`,
		},
		{
			desc:               "returns 403 if the user does not have the right permissions",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration",
			user:               userWithoutPermissions,
			expectedHttpResult: http.StatusForbidden,
			expectedBody:       "",
		},
		{
			desc:               "returns 500 if service returns an error",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusInternalServerError,
			expectedBody:       "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, runSimpleApiTest(tt))
	}
}

func TestCloudMigrationAPI_CreateMigration(t *testing.T) {
	tests := []TestCase{
		{
			desc:               "returns 200 if the user has the right permissions",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration",
			requestBody:        `{"auth_token":"asdf"}`,
			user:               userWithPermissions,
			expectedHttpResult: http.StatusOK,
			expectedBody:       `{"uid":"fake_uid","slug":"fake_stack","created":"2024-06-05T17:30:40Z","updated":"2024-06-05T17:30:40Z"}`,
		},
		{
			desc:               "returns 403 if the user does not have the right permissions",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration",
			user:               userWithoutPermissions,
			expectedHttpResult: http.StatusForbidden,
			expectedBody:       "",
		},
		{
			desc:               "returns 500 if service returns an error",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration",
			requestBody:        `{"authToken":"asdf"}`,
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusInternalServerError,
			expectedBody:       "",
		},
		{
			desc:               "returns 400 if body is not a valid json",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration",
			requestBody:        "asdf",
			user:               userWithPermissions,
			serviceReturnError: false,
			expectedHttpResult: http.StatusBadRequest,
			expectedBody:       "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, runSimpleApiTest(tt))
	}
}

func TestCloudMigrationAPI_DeleteMigration(t *testing.T) {
	tests := []TestCase{
		{
			desc:               "returns 200 if the user has the right permissions",
			requestHttpMethod:  http.MethodDelete,
			requestUrl:         "/api/cloudmigration/migration/1234",
			user:               userWithPermissions,
			expectedHttpResult: http.StatusOK,
			expectedBody:       "",
		},
		{
			desc:               "returns 403 if the user does not have the right permissions",
			requestHttpMethod:  http.MethodDelete,
			requestUrl:         "/api/cloudmigration/migration/1234",
			user:               userWithoutPermissions,
			expectedHttpResult: http.StatusForbidden,
			expectedBody:       "",
		},
		{
			desc:               "returns 500 if service returns an error",
			requestHttpMethod:  http.MethodDelete,
			requestUrl:         "/api/cloudmigration/migration/1234",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusInternalServerError,
			expectedBody:       "",
		},
		{
			desc:               "returns 400 if uid is invalid",
			requestHttpMethod:  http.MethodDelete,
			requestUrl:         "/api/cloudmigration/migration/****",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, runSimpleApiTest(tt))
	}
}

func TestCloudMigrationAPI_CreateSnapshot(t *testing.T) {
	tests := []TestCase{
		{
			desc:               "returns 200 if the user has the right permissions",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshot",
			user:               userWithPermissions,
			expectedHttpResult: http.StatusOK,
			expectedBody:       `{"uid":"fake_uid"}`,
		},
		{
			desc:               "returns 403 if the user does not have the right permissions",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshot",
			user:               userWithoutPermissions,
			expectedHttpResult: http.StatusForbidden,
			expectedBody:       "",
		},
		{
			desc:               "returns 500 if service returns an error",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshot",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusInternalServerError,
			expectedBody:       "",
		},
		{
			desc:               "returns 400 if uid is invalid",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration/***/snapshot",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, runSimpleApiTest(tt))
	}
}

func TestCloudMigrationAPI_GetSnapshot(t *testing.T) {
	tests := []TestCase{
		{
			desc:               "returns 200 if the user has the right permissions",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshot/1",
			user:               userWithPermissions,
			expectedHttpResult: http.StatusOK,
			expectedBody:       `{"uid":"fake_uid","status":"CREATING","sessionUid":"1234","created":"0001-01-01T00:00:00Z","finished":"0001-01-01T00:00:00Z","results":[{"name":"dashboard name","parentName":"dashboard parent name","type":"DASHBOARD","refId":"123","status":"PENDING"},{"name":"datasource name","parentName":"dashboard parent name","type":"DATASOURCE","refId":"456","status":"OK"}],"stats":{"types":{},"statuses":{},"total":0}}`,
		},
		{
			desc:               "returns 403 if the user does not have the right permissions",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshot/1",
			user:               userWithoutPermissions,
			expectedHttpResult: http.StatusForbidden,
			expectedBody:       "",
		},
		{
			desc:               "returns 500 if service returns an error",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshot/1",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusInternalServerError,
			expectedBody:       "",
		},
		{
			desc:               "returns 400 if uid is invalid",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/***/snapshot/1",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusBadRequest,
		},
		{
			desc:               "returns 400 if snapshot_uid is invalid",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshot/***",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, runSimpleApiTest(tt))
	}
}

func TestCloudMigrationAPI_GetSnapshotList(t *testing.T) {
	tests := []TestCase{
		{
			desc:               "returns 200 if the user has the right permissions",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshots",
			user:               userWithPermissions,
			expectedHttpResult: http.StatusOK,
			expectedBody:       `{"snapshots":[{"uid":"fake_uid","status":"CREATING","sessionUid":"1234","created":"2024-06-05T17:30:40Z","finished":"0001-01-01T00:00:00Z"},{"uid":"fake_uid","status":"CREATING","sessionUid":"1234","created":"2024-06-05T18:30:40Z","finished":"0001-01-01T00:00:00Z"}]}`,
		},
		{
			desc:               "with limit query param returns 200 if everything is ok",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshots?limit=1",
			user:               userWithPermissions,
			expectedHttpResult: http.StatusOK,
			expectedBody:       `{"snapshots":[{"uid":"fake_uid","status":"CREATING","sessionUid":"1234","created":"2024-06-05T17:30:40Z","finished":"0001-01-01T00:00:00Z"}]}`,
		},
		{
			desc:               "with sort query param returns 200 if everything is ok",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshots?sort=latest",
			user:               userWithPermissions,
			expectedHttpResult: http.StatusOK,
			expectedBody:       `{"snapshots":[{"uid":"fake_uid","status":"CREATING","sessionUid":"1234","created":"2024-06-05T18:30:40Z","finished":"0001-01-01T00:00:00Z"},{"uid":"fake_uid","status":"CREATING","sessionUid":"1234","created":"2024-06-05T17:30:40Z","finished":"0001-01-01T00:00:00Z"}]}`,
		},
		{
			desc:               "returns 403 if the user does not have the right permissions",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshots",
			user:               userWithoutPermissions,
			expectedHttpResult: http.StatusForbidden,
			expectedBody:       "",
		},
		{
			desc:               "returns 500 if service returns an error",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshots",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusInternalServerError,
			expectedBody:       "",
		},
		{
			desc:               "returns 400 if uid is invalid",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/***/snapshots",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, runSimpleApiTest(tt))
	}
}

func TestCloudMigrationAPI_UploadSnapshot(t *testing.T) {
	tests := []TestCase{
		{
			desc:               "returns 200 if the user has the right permissions",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshot/1/upload",
			user:               userWithPermissions,
			expectedHttpResult: http.StatusOK,
			expectedBody:       "",
		},
		{
			desc:               "returns 403 if the user does not have the right permissions",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshot/1/upload",
			user:               userWithoutPermissions,
			expectedHttpResult: http.StatusForbidden,
			expectedBody:       "",
		},
		{
			desc:               "returns 500 if service returns an error",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshot/1/upload",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusInternalServerError,
			expectedBody:       "",
		},
		{
			desc:               "returns 400 if uid is invalid",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration/***/snapshot/1/upload",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusBadRequest,
		},
		{
			desc:               "returns 400 if snapshot_uid is invalid",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshot/***/upload",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, runSimpleApiTest(tt))
	}
}

func TestCloudMigrationAPI_CancelSnapshot(t *testing.T) {
	tests := []TestCase{
		{
			desc:               "returns 200 if the user has the right permissions",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshot/1/cancel",
			user:               userWithPermissions,
			expectedHttpResult: http.StatusOK,
			expectedBody:       "",
		},
		{
			desc:               "returns 403 if the user does not have the right permissions",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshot/1/cancel",
			user:               userWithoutPermissions,
			expectedHttpResult: http.StatusForbidden,
			expectedBody:       "",
		},
		{
			desc:               "returns 500 if service returns an error",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshot/1/cancel",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusInternalServerError,
			expectedBody:       "",
		},
		{
			desc:               "returns 400 if uid is invalid",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration/***/snapshot/1/cancel",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusBadRequest,
		},
		{
			desc:               "returns 400 if snapshot_uid is invalid",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration/1234/snapshot/***/cancel",
			user:               userWithPermissions,
			serviceReturnError: true,
			expectedHttpResult: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, runSimpleApiTest(tt))
	}
}

func runSimpleApiTest(tt TestCase) func(t *testing.T) {
	return func(t *testing.T) {
		// setup server
		api := RegisterApi(
			routing.NewRouteRegister(),
			fake.FakeServiceImpl{ReturnError: tt.serviceReturnError},
			tracing.InitializeTracerForTest(),
			acimpl.ProvideAccessControlTest(),
		)

		server := webtest.NewServer(t, api.routeRegister)

		var body io.Reader = nil
		if tt.requestBody != "" {
			body = strings.NewReader(tt.requestBody)
		}
		req := server.NewRequest(tt.requestHttpMethod, tt.requestUrl, body)
		req.Header.Set("Content-Type", "application/json")

		// create test request
		webtest.RequestWithSignedInUser(req, tt.user)
		res, err := server.Send(req)
		t.Cleanup(func() { require.NoError(t, res.Body.Close()) })

		// validations
		require.NoError(t, err)
		require.Equal(t, tt.expectedHttpResult, res.StatusCode)
		if tt.expectedBody != "" {
			require.NotNil(t, t, res.Body)
			b, err := io.ReadAll(res.Body)
			require.NoError(t, err)
			require.Equal(t, tt.expectedBody, string(b))
		}
	}
}
