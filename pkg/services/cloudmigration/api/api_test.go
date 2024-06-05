package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/gcom"
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
	basicRole         org.RoleType
	// if the CloudMigrationService should return an error
	serviceReturnError bool
	expectedHttpResult int
	expectedBody       string
}

var fixedDate = time.Date(2024, 6, 5, 17, 30, 40, 0, time.UTC)

func TestCloudMigrationAPI_GetToken(t *testing.T) {
	tests := []TestCase{
		{
			desc:               "should return 200 if everything is ok",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/token",
			basicRole:          org.RoleAdmin,
			expectedHttpResult: http.StatusOK,
			expectedBody:       `{"id":"mock_id","displayName":"mock_name","expiresAt":"","firstUsedAt":"","lastUsedAt":"","createdAt":""}`,
		},
		{
			desc:               "should return 403 if no used is not admin",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/token",
			basicRole:          org.RoleEditor,
			expectedHttpResult: http.StatusForbidden,
			expectedBody:       "",
		},
		{
			desc:               "should return 500 if service returns an error",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/token",
			basicRole:          org.RoleAdmin,
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
			desc:               "should return 200 if everything is ok",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/token",
			basicRole:          org.RoleAdmin,
			expectedHttpResult: http.StatusOK,
			expectedBody:       `{"token":"mock_token"}`,
		},
		{
			desc:               "should return 403 if no used is not admin",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/token",
			basicRole:          org.RoleEditor,
			expectedHttpResult: http.StatusForbidden,
			expectedBody:       "",
		},
		{
			desc:               "should return 500 if service returns an error",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/token",
			basicRole:          org.RoleAdmin,
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
			desc:               "should return 200 if everything is ok",
			requestHttpMethod:  http.MethodDelete,
			requestUrl:         "/api/cloudmigration/token/1234",
			basicRole:          org.RoleAdmin,
			expectedHttpResult: http.StatusNoContent,
		},
		{
			desc:               "should return 403 if no used is not admin",
			requestHttpMethod:  http.MethodDelete,
			requestUrl:         "/api/cloudmigration/token/1234",
			basicRole:          org.RoleEditor,
			expectedHttpResult: http.StatusForbidden,
		},
		{
			desc:               "should return 500 if service returns an error",
			requestHttpMethod:  http.MethodDelete,
			requestUrl:         "/api/cloudmigration/token/1234",
			basicRole:          org.RoleAdmin,
			serviceReturnError: true,
			expectedHttpResult: http.StatusInternalServerError,
		},
		{
			desc:               "should return 400 if uid is invalid",
			requestHttpMethod:  http.MethodDelete,
			requestUrl:         "/api/cloudmigration/token/***",
			basicRole:          org.RoleAdmin,
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
			desc:               "should return 200 if everything is ok",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/1234",
			basicRole:          org.RoleAdmin,
			expectedHttpResult: http.StatusOK,
		},
		{
			desc:               "should return 403 if no used is not admin",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/1234",
			basicRole:          org.RoleEditor,
			expectedHttpResult: http.StatusForbidden,
		},
		{
			desc:               "should return 500 if service returns an error",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/1234",
			basicRole:          org.RoleAdmin,
			serviceReturnError: true,
			expectedHttpResult: http.StatusNotFound,
		},
		{
			desc:               "should return 400 if uid is invalid",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/****",
			basicRole:          org.RoleAdmin,
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
			desc:               "should return 200 if everything is ok",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration",
			basicRole:          org.RoleAdmin,
			expectedHttpResult: http.StatusOK,
			expectedBody:       `{"migrations":[{"uid":"mock_uid_1","stack":"mock_stack_1","created":"1969-12-31T21:00:05-03:00","updated":"2024-06-05T17:30:40Z"},{"uid":"mock_uid_2","stack":"mock_stack_2","created":"1969-12-31T21:00:05-03:00","updated":"2024-06-05T17:30:40Z"}]}`,
		},
		{
			desc:               "should return 403 if no used is not admin",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration",
			basicRole:          org.RoleEditor,
			expectedHttpResult: http.StatusForbidden,
			expectedBody:       "",
		},
		{
			desc:               "should return 500 if service returns an error",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration",
			basicRole:          org.RoleAdmin,
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
			desc:               "should return 200 if everything is ok",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration",
			requestBody:        `{"auth_token":"asdf"}`,
			basicRole:          org.RoleAdmin,
			expectedHttpResult: http.StatusOK,
			expectedBody:       `{"uid":"fake_uid","stack":"fake_stack","created":"2024-06-05T17:30:40Z","updated":"2024-06-05T17:30:40Z"}`,
		},
		{
			desc:               "should return 403 if no used is not admin",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration",
			basicRole:          org.RoleEditor,
			expectedHttpResult: http.StatusForbidden,
			expectedBody:       "",
		},
		{
			desc:               "should return 500 if service returns an error",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration",
			requestBody:        `{"authToken":"asdf"}`,
			basicRole:          org.RoleAdmin,
			serviceReturnError: true,
			expectedHttpResult: http.StatusInternalServerError,
			expectedBody:       "",
		},
		{
			desc:               "should return 400 if body is not a valid json",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration",
			requestBody:        "asdf",
			basicRole:          org.RoleAdmin,
			serviceReturnError: false,
			expectedHttpResult: http.StatusBadRequest,
			expectedBody:       "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, runSimpleApiTest(tt))
	}
}

func TestCloudMigrationAPI_RunMigration(t *testing.T) {
	tests := []TestCase{
		{
			desc:               "should return 200 if everything is ok",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration/1234/run",
			basicRole:          org.RoleAdmin,
			expectedHttpResult: http.StatusOK,
			expectedBody:       `{"uid":"fake_uid","items":[{"type":"type","refId":"make_refid","status":"ok","error":"none"}]}`,
		},
		{
			desc:               "should return 403 if no used is not admin",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration/1234/run",
			basicRole:          org.RoleEditor,
			expectedHttpResult: http.StatusForbidden,
			expectedBody:       "",
		},
		{
			desc:               "should return 500 if service returns an error",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration/1234/run",
			basicRole:          org.RoleAdmin,
			serviceReturnError: true,
			expectedHttpResult: http.StatusInternalServerError,
			expectedBody:       "",
		},
		{
			desc:               "should return 400 if uid is invalid",
			requestHttpMethod:  http.MethodPost,
			requestUrl:         "/api/cloudmigration/migration/***/run",
			basicRole:          org.RoleAdmin,
			serviceReturnError: true,
			expectedHttpResult: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, runSimpleApiTest(tt))
	}
}

func TestCloudMigrationAPI_GetMigrationRun(t *testing.T) {
	tests := []TestCase{
		{
			desc:               "should return 200 if everything is ok",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/run/1234",
			basicRole:          org.RoleAdmin,
			expectedHttpResult: http.StatusOK,
			expectedBody:       `{"uid":"fake_uid","items":[{"type":"type","refId":"make_refid","status":"ok","error":"none"}]}`,
		},
		{
			desc:               "should return 403 if no used is not admin",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/run/1234",
			basicRole:          org.RoleEditor,
			expectedHttpResult: http.StatusForbidden,
			expectedBody:       "",
		},
		{
			desc:               "should return 500 if service returns an error",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/run/1234",
			basicRole:          org.RoleAdmin,
			serviceReturnError: true,
			expectedHttpResult: http.StatusInternalServerError,
			expectedBody:       "",
		},
		{
			desc:               "should return 400 if uid is invalid",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/run/****",
			basicRole:          org.RoleAdmin,
			serviceReturnError: true,
			expectedHttpResult: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, runSimpleApiTest(tt))
	}
}

func TestCloudMigrationAPI_GetMigrationRunList(t *testing.T) {
	tests := []TestCase{
		{
			desc:               "should return 200 if everything is ok",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/1234/run",
			basicRole:          org.RoleAdmin,
			expectedHttpResult: http.StatusOK,
			expectedBody:       `{"runs":[{"uid":"fake_run_uid_1"},{"uid":"fake_run_uid_2"}]}`,
		},
		{
			desc:               "should return 403 if no used is not admin",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/1234/run",
			basicRole:          org.RoleEditor,
			expectedHttpResult: http.StatusForbidden,
			expectedBody:       "",
		},
		{
			desc:               "should return 500 if service returns an error",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/1234/run",
			basicRole:          org.RoleAdmin,
			serviceReturnError: true,
			expectedHttpResult: http.StatusInternalServerError,
			expectedBody:       "",
		},
		{
			desc:               "should return 400 if uid is invalid",
			requestHttpMethod:  http.MethodGet,
			requestUrl:         "/api/cloudmigration/migration/****/run",
			basicRole:          org.RoleAdmin,
			serviceReturnError: true,
			expectedHttpResult: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, runSimpleApiTest(tt))
	}
}

func TestCloudMigrationAPI_DeleteMigration(t *testing.T) {
	tests := []TestCase{
		{
			desc:               "should return 200 if everything is ok",
			requestHttpMethod:  http.MethodDelete,
			requestUrl:         "/api/cloudmigration/migration/1234",
			basicRole:          org.RoleAdmin,
			expectedHttpResult: http.StatusOK,
			expectedBody:       "",
		},
		{
			desc:               "should return 403 if no used is not admin",
			requestHttpMethod:  http.MethodDelete,
			requestUrl:         "/api/cloudmigration/migration/1234",
			basicRole:          org.RoleEditor,
			expectedHttpResult: http.StatusForbidden,
			expectedBody:       "",
		},
		{
			desc:               "should return 500 if service returns an error",
			requestHttpMethod:  http.MethodDelete,
			requestUrl:         "/api/cloudmigration/migration/1234",
			basicRole:          org.RoleAdmin,
			serviceReturnError: true,
			expectedHttpResult: http.StatusInternalServerError,
			expectedBody:       "",
		},
		{
			desc:               "should return 400 if uid is invalid",
			requestHttpMethod:  http.MethodDelete,
			requestUrl:         "/api/cloudmigration/migration/****",
			basicRole:          org.RoleAdmin,
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
		api := RegisterApi(routing.NewRouteRegister(), mockServiceImpl{returnError: tt.serviceReturnError}, tracing.InitializeTracerForTest())
		server := webtest.NewServer(t, api.routeRegister)

		var body io.Reader = nil
		if tt.requestBody != "" {
			body = strings.NewReader(tt.requestBody)
		}
		req := server.NewRequest(tt.requestHttpMethod, tt.requestUrl, body)
		req.Header.Set("Content-Type", "application/json")

		// create test request
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{
			OrgID:   1,
			OrgRole: tt.basicRole,
		})
		res, err := server.Send(req)
		defer func() { require.NoError(t, res.Body.Close()) }()
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

// -- Mock Service

// mockServiceImpl Define the Service Implementation.
type mockServiceImpl struct {
	returnError bool
}

var _ cloudmigration.Service = (*mockServiceImpl)(nil)

func (m mockServiceImpl) GetToken(_ context.Context) (gcom.TokenView, error) {
	if m.returnError {
		return gcom.TokenView{}, fmt.Errorf("mock error")
	}
	return gcom.TokenView{ID: "mock_id", DisplayName: "mock_name"}, nil
}

func (m mockServiceImpl) CreateToken(_ context.Context) (cloudmigration.CreateAccessTokenResponse, error) {
	if m.returnError {
		return cloudmigration.CreateAccessTokenResponse{}, fmt.Errorf("mock error")
	}
	return cloudmigration.CreateAccessTokenResponse{Token: "mock_token"}, nil
}

func (m mockServiceImpl) ValidateToken(ctx context.Context, migration cloudmigration.CloudMigration) error {
	panic("implement me")
}

func (m mockServiceImpl) DeleteToken(_ context.Context, _ string) error {
	if m.returnError {
		return fmt.Errorf("mock error")
	}
	return nil
}

func (m mockServiceImpl) CreateMigration(_ context.Context, _ cloudmigration.CloudMigrationRequest) (*cloudmigration.CloudMigrationResponse, error) {
	if m.returnError {
		return nil, fmt.Errorf("mock error")
	}
	return &cloudmigration.CloudMigrationResponse{
		UID:     "fake_uid",
		Stack:   "fake_stack",
		Created: fixedDate,
		Updated: fixedDate,
	}, nil
}

func (m mockServiceImpl) GetMigration(_ context.Context, _ string) (*cloudmigration.CloudMigration, error) {
	if m.returnError {
		return nil, fmt.Errorf("mock error")
	}
	return &cloudmigration.CloudMigration{UID: "fake"}, nil
}

func (m mockServiceImpl) DeleteMigration(_ context.Context, _ string) (*cloudmigration.CloudMigration, error) {
	if m.returnError {
		return nil, fmt.Errorf("mock error")
	}
	return &cloudmigration.CloudMigration{UID: "fake"}, nil
}

func (m mockServiceImpl) UpdateMigration(ctx context.Context, uid string, request cloudmigration.CloudMigrationRequest) (*cloudmigration.CloudMigrationResponse, error) {
	panic("implement me")
}

func (m mockServiceImpl) GetMigrationList(_ context.Context) (*cloudmigration.CloudMigrationListResponse, error) {
	if m.returnError {
		return nil, fmt.Errorf("mock error")
	}
	return &cloudmigration.CloudMigrationListResponse{
		Migrations: []cloudmigration.CloudMigrationResponse{
			{UID: "mock_uid_1", Stack: "mock_stack_1", Created: time.Unix(5, 0), Updated: fixedDate},
			{UID: "mock_uid_2", Stack: "mock_stack_2", Created: time.Unix(5, 0), Updated: fixedDate},
		},
	}, nil
}

func (m mockServiceImpl) RunMigration(_ context.Context, _ string) (*cloudmigration.MigrateDataResponseDTO, error) {
	if m.returnError {
		return nil, fmt.Errorf("mock error")
	}
	r := fakeMigrateDataResponseDTO()
	return &r, nil
}

func fakeMigrateDataResponseDTO() cloudmigration.MigrateDataResponseDTO {
	return cloudmigration.MigrateDataResponseDTO{
		RunUID: "fake_uid",
		Items: []cloudmigration.MigrateDataResponseItemDTO{
			{Type: "type", RefID: "make_refid", Status: "ok", Error: "none"},
		},
	}
}

func (m mockServiceImpl) CreateMigrationRun(ctx context.Context, run cloudmigration.CloudMigrationRun) (string, error) {
	panic("implement me")
}

func (m mockServiceImpl) GetMigrationStatus(ctx context.Context, runUID string) (*cloudmigration.CloudMigrationRun, error) {
	if m.returnError {
		return nil, fmt.Errorf("mock error")
	}
	result, err := json.Marshal(fakeMigrateDataResponseDTO())
	if err != nil {
		return nil, err
	}
	return &cloudmigration.CloudMigrationRun{
		ID:                0,
		UID:               "fake_uid",
		CloudMigrationUID: "fake_mig_uid",
		Result:            result,
		Created:           fixedDate,
		Updated:           fixedDate,
		Finished:          fixedDate,
	}, nil
}

func (m mockServiceImpl) GetMigrationRunList(_ context.Context, _ string) (*cloudmigration.CloudMigrationRunList, error) {
	if m.returnError {
		return nil, fmt.Errorf("mock error")
	}
	return &cloudmigration.CloudMigrationRunList{
		Runs: []cloudmigration.MigrateDataResponseListDTO{
			{RunUID: "fake_run_uid_1"},
			{RunUID: "fake_run_uid_2"},
		},
	}, nil
}
