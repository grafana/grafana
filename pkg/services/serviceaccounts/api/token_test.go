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

	"github.com/grafana/grafana/pkg/web/webtest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/apikeygen"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

func TestServiceAccountsAPI_CreateToken(t *testing.T) {
	type TestCase struct {
		desc           string
		id             int64
		body           string
		permissions    []accesscontrol.Permission
		tokenTTL       int64
		expectedErr    error
		expectedApiKey *apikey.APIKey
		expectedCode   int
	}

	tests := []TestCase{
		{
			desc:           "should be able to create token for service account with correct permission",
			id:             1,
			body:           `{"name": "test"}`,
			tokenTTL:       -1,
			permissions:    []accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: "serviceaccounts:id:1"}},
			expectedApiKey: &apikey.APIKey{},
			expectedCode:   http.StatusOK,
		},
		{
			desc:         "should not be able to create token for service account with wrong permission",
			id:           2,
			body:         `{"name": "test"}`,
			tokenTTL:     -1,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: "serviceaccounts:id:1"}},
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "should not be able to create token for service account that dont exists",
			id:           1,
			body:         `{"name": "test"}`,
			tokenTTL:     -1,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: "serviceaccounts:id:1"}},
			expectedErr:  serviceaccounts.ErrServiceAccountNotFound,
			expectedCode: http.StatusNotFound,
		},
		{
			desc:         "should not be able to create token for service account if max ttl is configured but not set in body",
			id:           1,
			body:         `{"name": "test"}`,
			tokenTTL:     10 * int64(time.Hour),
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: "serviceaccounts:id:1"}},
			expectedCode: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := setupTests(t, func(a *ServiceAccountsAPI) {
				a.cfg.ApiKeyMaxSecondsToLive = tt.tokenTTL
				a.service = &fakeService{
					ExpectedErr:    tt.expectedErr,
					ExpectedApiKey: tt.expectedApiKey,
				}
			})
			req := server.NewRequest(http.MethodPost, fmt.Sprintf("/api/serviceaccounts/%d/tokens", tt.id), strings.NewReader(tt.body))
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByAction(tt.permissions)}})
			res, err := server.SendJSON(req)
			require.NoError(t, err)
			defer res.Body.Close()

			assert.Equal(t, tt.expectedCode, res.StatusCode)
		})
	}

}

func TestServiceAccountsAPI_DeleteToken(t *testing.T) {
	type TestCase struct {
		desc         string
		saID         int64
		apikeyID     int64
		permissions  []accesscontrol.Permission
		expectedErr  error
		expectedCode int
	}

	tests := []TestCase{
		{
			desc:         "should be able to delete service account token with correct permission",
			saID:         1,
			apikeyID:     1,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: "serviceaccounts:id:1"}},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "should not be able to delete service account token with wrong permission",
			saID:         2,
			apikeyID:     1,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: "serviceaccounts:id:1"}},
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "should not be able to delete service account token when service account don't exist",
			saID:         1,
			apikeyID:     1,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: "serviceaccounts:id:1"}},
			expectedErr:  serviceaccounts.ErrServiceAccountNotFound,
			expectedCode: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := setupTests(t, func(a *ServiceAccountsAPI) {
				a.service = &fakeService{ExpectedErr: tt.expectedErr}
			})

			req := server.NewRequest(http.MethodDelete, fmt.Sprintf("/api/serviceaccounts/%d/tokens/%d", tt.saID, tt.apikeyID), nil)
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByAction(tt.permissions)}})
			res, err := server.SendJSON(req)
			require.NoError(t, err)
			defer res.Body.Close()

			assert.Equal(t, tt.expectedCode, res.StatusCode)
		})
	}
}

const (
	serviceaccountIDTokensPath       = "/api/serviceaccounts/%v/tokens"    // #nosec G101
	serviceaccountIDTokensDetailPath = "/api/serviceaccounts/%v/tokens/%v" // #nosec G101
)

func createTokenforSA(t *testing.T, service serviceaccounts.Service, keyName string, orgID int64, saID int64, secondsToLive int64) *apikey.APIKey {
	key, err := apikeygen.New(orgID, keyName)
	require.NoError(t, err)

	cmd := serviceaccounts.AddServiceAccountTokenCommand{
		Name:          keyName,
		OrgId:         orgID,
		Key:           key.HashedKey,
		SecondsToLive: secondsToLive,
		Result:        &apikey.APIKey{},
	}

	err = service.AddServiceAccountToken(context.Background(), saID, &cmd)
	require.NoError(t, err)
	return cmd.Result
}

func TestServiceAccountsAPI_ListTokens(t *testing.T) {
	store := db.InitTestDB(t)
	services := setupTestServices(t, store)

	sa := tests.SetupUserServiceAccount(t, store, tests.TestUser{Login: "sa", IsServiceAccount: true})
	type testCreateSAToken struct {
		desc                      string
		tokens                    []apikey.APIKey
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
			tokens: []apikey.APIKey{{
				Id:               1,
				OrgId:            1,
				ServiceAccountId: &saId,
				Expires:          nil,
				Name:             "Test1",
			}},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{{Action: serviceaccounts.ActionRead, Scope: "serviceaccounts:id:1"}}, nil
				},
				false,
			),
			expectedHasExpired:        false,
			expectedResponseBodyField: "hasExpired",
			expectedCode:              http.StatusOK,
		},
		{
			desc: "should be able to list serviceaccount with secondsUntilExpiration",
			tokens: []apikey.APIKey{{
				Id:               1,
				OrgId:            1,
				ServiceAccountId: &saId,
				Expires:          &timeInFuture,
				Name:             "Test2",
			}},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{{Action: serviceaccounts.ActionRead, Scope: "serviceaccounts:id:1"}}, nil
				},
				false,
			),
			expectedHasExpired:        false,
			expectedResponseBodyField: "secondsUntilExpiration",
			expectedCode:              http.StatusOK,
		},
		{
			desc: "should be able to list serviceaccount with expired token",
			tokens: []apikey.APIKey{{
				Id:               1,
				OrgId:            1,
				ServiceAccountId: &saId,
				Expires:          &timeInPast,
				Name:             "Test3",
			}},
			acmock: tests.SetupMockAccesscontrol(
				t,
				func(c context.Context, siu *user.SignedInUser, _ accesscontrol.Options) ([]accesscontrol.Permission, error) {
					return []accesscontrol.Permission{{Action: serviceaccounts.ActionRead, Scope: "serviceaccounts:id:1"}}, nil
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
			endpoint := fmt.Sprintf(serviceAccountIDPath+"/tokens", sa.ID)
			services.SAService.ExpectedTokens = tc.tokens
			server, _ := setupTestServer(t, &services.SAService, routing.NewRouteRegister(), tc.acmock, store)
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
