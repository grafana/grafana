package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	serviceaccountIDTokensPath       = "/api/serviceaccounts/%v/tokens"    // #nosec G101
	serviceaccountIDTokensDetailPath = "/api/serviceaccounts/%v/tokens/%v" // #nosec G101
)

func createTokenforSA(t *testing.T, keyName string, orgID int64, saID int64) *models.ApiKey {
	key, err := apikeygen.New(orgID, keyName)
	require.NoError(t, err)
	cmd := models.AddApiKeyCommand{
		Name:             keyName,
		Role:             "Viewer",
		OrgId:            orgID,
		Key:              key.HashedKey,
		SecondsToLive:    0,
		ServiceAccountId: &saID,
		Result:           &models.ApiKey{},
	}
	err = bus.Dispatch(context.Background(), &cmd)
	require.NoError(t, err)

	return cmd.Result
}

func TestServiceAccountsAPI_CreateToken(t *testing.T) {
	store := sqlstore.InitTestDB(t)
	svcmock := tests.ServiceAccountMock{}
	sa := tests.SetupUserServiceAccount(t, store, tests.TestUser{Login: "sa", IsServiceAccount: true})

	type testCreateSAToken struct {
		desc         string
		expectedCode int
		body         map[string]interface{}
		acmock       *accesscontrolmock.Mock
	}

	testCases := []testCreateSAToken{
		{
			desc: "should be ok to create serviceaccount token with scope all permissions",
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: serviceaccounts.ScopeAll}}, nil
				},
				false,
			),
			body:         map[string]interface{}{"name": "Test1", "role": "Viewer", "secondsToLive": 1},
			expectedCode: http.StatusOK,
		},
		{
			desc: "serviceaccount token should match SA orgID and SA provided in parameters even if specified in body",
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: serviceaccounts.ScopeAll}}, nil
				},
				false,
			),
			body:         map[string]interface{}{"name": "Test2", "role": "Viewer", "secondsToLive": 1, "orgId": 4, "serviceAccountId": 4},
			expectedCode: http.StatusOK,
		},
		{
			desc: "should be ok to create serviceaccount token with scope id permissions",
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: "serviceaccounts:id:1"}}, nil
				},
				false,
			),
			body:         map[string]interface{}{"name": "Test3", "role": "Viewer", "secondsToLive": 1},
			expectedCode: http.StatusOK,
		},
		{
			desc: "should be forbidden to create serviceaccount token if wrong scoped",
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: "serviceaccounts:id:2"}}, nil
				},
				false,
			),
			body:         map[string]interface{}{"name": "Test4", "role": "Viewer"},
			expectedCode: http.StatusForbidden,
		},
	}

	var requestResponse = func(server *web.Mux, httpMethod, requestpath string, requestBody io.Reader) *httptest.ResponseRecorder {
		req, err := http.NewRequest(httpMethod, requestpath, requestBody)
		require.NoError(t, err)
		req.Header.Add("Content-Type", "application/json")
		recorder := httptest.NewRecorder()
		server.ServeHTTP(recorder, req)
		return recorder
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			endpoint := fmt.Sprintf(serviceaccountIDTokensPath, sa.Id)
			bodyString := ""
			if tc.body != nil {
				b, err := json.Marshal(tc.body)
				require.NoError(t, err)
				bodyString = string(b)
			}

			server := setupTestServer(t, &svcmock, routing.NewRouteRegister(), tc.acmock, store)
			actual := requestResponse(server, http.MethodPost, endpoint, strings.NewReader(bodyString))

			actualCode := actual.Code
			actualBody := map[string]interface{}{}

			err := json.Unmarshal(actual.Body.Bytes(), &actualBody)
			require.NoError(t, err)
			require.Equal(t, tc.expectedCode, actualCode, endpoint, actualBody)

			if actualCode == http.StatusOK {
				assert.Equal(t, tc.body["name"], actualBody["name"])

				query := models.GetApiKeyByNameQuery{KeyName: tc.body["name"].(string), OrgId: sa.OrgId}
				err = store.GetApiKeyByName(context.Background(), &query)
				require.NoError(t, err)

				assert.Equal(t, sa.Id, *query.Result.ServiceAccountId)
				assert.Equal(t, sa.OrgId, query.Result.OrgId)
			}
		})
	}
}

func TestServiceAccountsAPI_DeleteToken(t *testing.T) {
	store := sqlstore.InitTestDB(t)
	svcmock := tests.ServiceAccountMock{}
	sa := tests.SetupUserServiceAccount(t, store, tests.TestUser{Login: "sa", IsServiceAccount: true})

	type testCreateSAToken struct {
		desc         string
		keyName      string
		expectedCode int
		acmock       *accesscontrolmock.Mock
	}

	testCases := []testCreateSAToken{
		{
			desc:    "should be ok to delete serviceaccount token with scope id permissions",
			keyName: "Test1",
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: "serviceaccounts:id:1"}}, nil
				},
				false,
			),
			expectedCode: http.StatusOK,
		},
		{
			desc:    "should be ok to delete serviceaccount token with scope all permissions",
			keyName: "Test2",
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: serviceaccounts.ScopeAll}}, nil
				},
				false,
			),
			expectedCode: http.StatusOK,
		},
		{
			desc:    "should be forbidden to delete serviceaccount token if wrong scoped",
			keyName: "Test3",
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: "serviceaccounts:id:10"}}, nil
				},
				false,
			),
			expectedCode: http.StatusForbidden,
		},
	}

	var requestResponse = func(server *web.Mux, httpMethod, requestpath string, requestBody io.Reader) *httptest.ResponseRecorder {
		req, err := http.NewRequest(httpMethod, requestpath, requestBody)
		require.NoError(t, err)
		req.Header.Add("Content-Type", "application/json")
		recorder := httptest.NewRecorder()
		server.ServeHTTP(recorder, req)
		return recorder
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			token := createTokenforSA(t, tc.keyName, sa.OrgId, sa.Id)

			endpoint := fmt.Sprintf(serviceaccountIDTokensDetailPath, sa.Id, token.Id)
			bodyString := ""
			server := setupTestServer(t, &svcmock, routing.NewRouteRegister(), tc.acmock, store)
			actual := requestResponse(server, http.MethodDelete, endpoint, strings.NewReader(bodyString))

			actualCode := actual.Code
			actualBody := map[string]interface{}{}

			_ = json.Unmarshal(actual.Body.Bytes(), &actualBody)
			require.Equal(t, tc.expectedCode, actualCode, endpoint, actualBody)

			query := models.GetApiKeyByNameQuery{KeyName: tc.keyName, OrgId: sa.OrgId}
			err := store.GetApiKeyByName(context.Background(), &query)
			if actualCode == http.StatusOK {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
