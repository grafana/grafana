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
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/apikeygen"
	apikeygenprefix "github.com/grafana/grafana/pkg/components/apikeygenprefixed"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/database"
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

func createTokenforSA(t *testing.T, store serviceaccounts.Store, keyName string, orgID int64, saID int64, secondsToLive int64) *models.ApiKey {
	key, err := apikeygen.New(orgID, keyName)
	require.NoError(t, err)

	cmd := serviceaccounts.AddServiceAccountTokenCommand{
		Name:          keyName,
		OrgId:         orgID,
		Key:           key.HashedKey,
		SecondsToLive: secondsToLive,
		Result:        &models.ApiKey{},
	}

	err = store.AddServiceAccountToken(context.Background(), saID, &cmd)
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

			server, _ := setupTestServer(t, &svcmock, routing.NewRouteRegister(), tc.acmock, store, database.NewServiceAccountsStore(store))
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
				assert.True(t, strings.HasPrefix(actualBody["key"].(string), "glsa"))

				keyInfo, err := apikeygenprefix.Decode(actualBody["key"].(string))
				assert.NoError(t, err)

				hash, err := keyInfo.Hash()
				require.NoError(t, err)
				require.Equal(t, query.Result.Key, hash)
			}
		})
	}
}

func TestServiceAccountsAPI_DeleteToken(t *testing.T) {
	store := sqlstore.InitTestDB(t)
	svcMock := &tests.ServiceAccountMock{}
	saStore := database.NewServiceAccountsStore(store)
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
			token := createTokenforSA(t, saStore, tc.keyName, sa.OrgId, sa.Id, 1)

			endpoint := fmt.Sprintf(serviceaccountIDTokensDetailPath, sa.Id, token.Id)
			bodyString := ""
			server, _ := setupTestServer(t, svcMock, routing.NewRouteRegister(), tc.acmock, store, saStore)
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

type saStoreMockTokens struct {
	serviceaccounts.Store
	saAPIKeys []*models.ApiKey
}

func (s *saStoreMockTokens) ListTokens(ctx context.Context, orgID, saID int64) ([]*models.ApiKey, error) {
	return s.saAPIKeys, nil
}

func TestServiceAccountsAPI_ListTokens(t *testing.T) {
	store := sqlstore.InitTestDB(t)
	svcmock := tests.ServiceAccountMock{}
	sa := tests.SetupUserServiceAccount(t, store, tests.TestUser{Login: "sa", IsServiceAccount: true})

	type testCreateSAToken struct {
		desc                      string
		tokens                    []*models.ApiKey
		expectedHasExpired        bool
		expectedResponseBodyField string
		expectedCode              int
		acmock                    *accesscontrolmock.Mock
	}

	var saId int64 = 1
	var timeInFuture = time.Now().Add(time.Second * 100).Unix()
	var timeInPast = time.Now().Add(-time.Second * 100).Unix()

	testCases := []testCreateSAToken{
		{
			desc: "should be able to list serviceaccount with no expiration date",
			tokens: []*models.ApiKey{{
				Id:               1,
				OrgId:            1,
				ServiceAccountId: &saId,
				Expires:          nil,
				Name:             "Test1",
			}},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionRead, Scope: "serviceaccounts:id:1"}}, nil
				},
				false,
			),
			expectedHasExpired:        false,
			expectedResponseBodyField: "hasExpired",
			expectedCode:              http.StatusOK,
		},
		{
			desc: "should be able to list serviceaccount with secondsUntilExpiration",
			tokens: []*models.ApiKey{{
				Id:               1,
				OrgId:            1,
				ServiceAccountId: &saId,
				Expires:          &timeInFuture,
				Name:             "Test2",
			}},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionRead, Scope: "serviceaccounts:id:1"}}, nil
				},
				false,
			),
			expectedHasExpired:        false,
			expectedResponseBodyField: "secondsUntilExpiration",
			expectedCode:              http.StatusOK,
		},
		{
			desc: "should be able to list serviceaccount with expired token",
			tokens: []*models.ApiKey{{
				Id:               1,
				OrgId:            1,
				ServiceAccountId: &saId,
				Expires:          &timeInPast,
				Name:             "Test3",
			}},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *models.SignedInUser, _ accesscontrol.Options) ([]*accesscontrol.Permission, error) {
					return []*accesscontrol.Permission{{Action: serviceaccounts.ActionRead, Scope: "serviceaccounts:id:1"}}, nil
				},
				false,
			),
			expectedHasExpired:        true,
			expectedResponseBodyField: "secondsUntilExpiration",
			expectedCode:              http.StatusOK,
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
			endpoint := fmt.Sprintf(serviceAccountIDPath+"/tokens", sa.Id)
			server, _ := setupTestServer(t, &svcmock, routing.NewRouteRegister(), tc.acmock, store, &saStoreMockTokens{saAPIKeys: tc.tokens})
			actual := requestResponse(server, http.MethodGet, endpoint, http.NoBody)

			actualCode := actual.Code
			actualBody := []map[string]interface{}{}

			_ = json.Unmarshal(actual.Body.Bytes(), &actualBody)
			require.Equal(t, tc.expectedCode, actualCode, endpoint, actualBody)

			require.Equal(t, tc.expectedCode, actualCode)
			require.Equal(t, tc.expectedHasExpired, actualBody[0]["hasExpired"])
			_, exists := actualBody[0][tc.expectedResponseBodyField]
			require.Equal(t, exists, true)
		})
	}
}
