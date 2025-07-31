package api

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	satests "github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestServiceAccountsAPI_ListTokens(t *testing.T) {
	type TestCase struct {
		desc         string
		id           int64
		permissions  []accesscontrol.Permission
		expectedCode int
	}

	tests := []TestCase{
		{
			desc:         "should be able to list tokens with correct permission",
			id:           1,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionRead, Scope: "serviceaccounts:id:1"}},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "should not be able to list tokens with wrong permission",
			id:           2,
			permissions:  []accesscontrol.Permission{{Action: serviceaccounts.ActionRead, Scope: "serviceaccounts:id:1"}},
			expectedCode: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := setupTests(t, func(a *ServiceAccountsAPI) {
				a.service = &satests.FakeServiceAccountService{}
			})
			req := server.NewGetRequest(fmt.Sprintf("/api/serviceaccounts/%d/tokens", tt.id))
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions)}})
			res, err := server.Send(req)
			require.NoError(t, err)

			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestServiceAccountsAPI_CreateToken(t *testing.T) {
	type TestCase struct {
		desc           string
		id             int64
		body           string
		permissions    []accesscontrol.Permission
		tokenTTL       int64
		expectedErr    error
		expectedAPIKey *apikey.APIKey
		expectedCode   int
	}

	tests := []TestCase{
		{
			desc:           "should be able to create token for service account with correct permission",
			id:             1,
			body:           `{"name": "test"}`,
			tokenTTL:       -1,
			permissions:    []accesscontrol.Permission{{Action: serviceaccounts.ActionWrite, Scope: "serviceaccounts:id:1"}},
			expectedAPIKey: &apikey.APIKey{},
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
			expectedErr:  serviceaccounts.ErrServiceAccountNotFound.Errorf(""),
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
				cfg := a.settingsProvider.Get()
				cfg.ApiKeyMaxSecondsToLive = tt.tokenTTL
				a.service = &satests.FakeServiceAccountService{
					ExpectedErr:    tt.expectedErr,
					ExpectedAPIKey: tt.expectedAPIKey,
				}
			})
			req := server.NewRequest(http.MethodPost, fmt.Sprintf("/api/serviceaccounts/%d/tokens", tt.id), strings.NewReader(tt.body))
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions)}})
			res, err := server.SendJSON(req)
			require.NoError(t, err)

			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
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
			expectedErr:  serviceaccounts.ErrServiceAccountNotFound.Errorf(""),
			expectedCode: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := setupTests(t, func(a *ServiceAccountsAPI) {
				a.service = &satests.FakeServiceAccountService{ExpectedErr: tt.expectedErr}
			})

			req := server.NewRequest(http.MethodDelete, fmt.Sprintf("/api/serviceaccounts/%d/tokens/%d", tt.saID, tt.apikeyID), nil)
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions)}})
			res, err := server.SendJSON(req)
			require.NoError(t, err)

			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}
