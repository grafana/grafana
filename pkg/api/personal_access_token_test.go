package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/stretchr/testify/require"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patpolicy"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type fakePATService struct {
	tokens     []*patstore.Token
	created    personalaccesstokens.CreateRequest
	revokedUID string
	revokedFor int64
	reason     string
	query      patstore.SearchQuery
	revokedOrg int64
}

func (f *fakePATService) Create(_ context.Context, _ personalaccesstokens.Actor, req personalaccesstokens.CreateRequest) (*personalaccesstokens.CreateResult, error) {
	f.created = req
	return &personalaccesstokens.CreateResult{Token: &patstore.Token{UID: "u1", Name: req.Name, CreatedAt: time.Now()}, Secret: "glpat_secret"}, nil
}

func (f *fakePATService) List(context.Context, int64, int64) ([]*patstore.Token, error) {
	return f.tokens, nil
}

func (f *fakePATService) Revoke(_ context.Context, _ personalaccesstokens.Actor, userID int64, uid, reason string) error {
	f.revokedUID, f.revokedFor, f.reason = uid, userID, reason
	return nil
}

func (f *fakePATService) Search(_ context.Context, q patstore.SearchQuery) (*patstore.SearchResult, error) {
	f.query = q
	return &patstore.SearchResult{Total: 1, Tokens: []*patstore.TokenWithOwner{{Token: patstore.Token{UID: "u1", Name: "ci", OrgID: 1, UserID: 3}, OwnerLogin: "bob", OrgName: "Main"}}}, nil
}

func (f *fakePATService) AdminRevoke(_ context.Context, _ personalaccesstokens.Actor, orgID int64, uid string) error {
	f.revokedUID, f.revokedOrg = uid, orgID
	return nil
}

func (f *fakePATService) RevokeAllForUser(context.Context, personalaccesstokens.Actor, int64, string) (int64, error) {
	return 0, nil
}

func patReqContext(method, target, body string, params map[string]string, authBy string) *contextmodel.ReqContext {
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = web.SetURLParams(req, params)
	return &contextmodel.ReqContext{
		Context: &web.Context{Req: req},
		SignedInUser: &user.SignedInUser{
			UserID: 7, OrgID: 1, OrgRole: "Viewer", FallbackType: claims.TypeUser,
			Permissions:     map[int64]map[string][]string{1: {"dashboards:read": {"dashboards:*"}}},
			AuthenticatedBy: authBy,
		},
	}
}

func TestPersonalAccessTokenHandlers(t *testing.T) {
	t.Run("create returns secret once and never lists it", func(t *testing.T) {
		svc := &fakePATService{}
		hs := &HTTPServer{personalTokenService: svc}
		c := patReqContext(http.MethodPost, "/api/user/tokens", `{"name":"ci","scopes":{"dashboards:read":["dashboards:*"]}}`, nil, "")
		res := hs.CreateUserPersonalAccessToken(c)
		require.Equal(t, http.StatusOK, res.Status())
		var out CreatePersonalAccessTokenResponse
		require.NoError(t, json.Unmarshal(res.Body(), &out))
		require.Equal(t, "glpat_secret", out.Token)
		require.Equal(t, "ci", svc.created.Name)
		require.Contains(t, svc.created.OwnerPermissions, "dashboards:read")

		svc.tokens = []*patstore.Token{{UID: "u1", Name: "ci"}}
		res = hs.ListUserPersonalAccessTokens(c)
		require.Equal(t, http.StatusOK, res.Status())
		require.NotContains(t, string(res.Body()), "glpat_")
		require.NotContains(t, strings.ToLower(string(res.Body())), "\"token\"")
	})

	t.Run("create and revoke email the owner without the secret", func(t *testing.T) {
		svc := &fakePATService{tokens: []*patstore.Token{{UID: "abc", Name: "ci"}}}
		var sent []*notifications.SendEmailCommand
		mock := notifications.MockNotificationService()
		mock.EmailHandler = func(_ context.Context, cmd *notifications.SendEmailCommand) error {
			sent = append(sent, cmd)
			return nil
		}
		users := usertest.NewUserServiceFake()
		users.ExpectedUser = &user.User{ID: 7, Email: "owner@example.com", Login: "owner"}
		hs := &HTTPServer{personalTokenService: svc, NotificationService: mock, userService: users}

		c := patReqContext(http.MethodPost, "/api/user/tokens", `{"name":"ci","scopes":{"dashboards:read":["dashboards:*"]}}`, nil, "")
		require.Equal(t, http.StatusOK, hs.CreateUserPersonalAccessToken(c).Status())
		c = patReqContext(http.MethodDelete, "/api/user/tokens/abc", "", map[string]string{":uid": "abc"}, "")
		require.Equal(t, http.StatusOK, hs.RevokeUserPersonalAccessToken(c).Status())

		require.Len(t, sent, 2)
		require.Equal(t, "created", sent[0].Data["Event"])
		require.Equal(t, "revoked", sent[1].Data["Event"])
		for _, m := range sent {
			require.Equal(t, []string{"owner@example.com"}, m.To)
			require.NotContains(t, m.Data, "Token")
		}
	})

	t.Run("a token cannot create tokens", func(t *testing.T) {
		hs := &HTTPServer{personalTokenService: &fakePATService{}}
		c := patReqContext(http.MethodPost, "/api/user/tokens", `{"name":"x"}`, nil, login.PersonalTokenAuthModule)
		require.Equal(t, http.StatusForbidden, hs.CreateUserPersonalAccessToken(c).Status())
	})

	t.Run("revoke uses user and admin reasons", func(t *testing.T) {
		svc := &fakePATService{}
		hs := &HTTPServer{personalTokenService: svc}
		c := patReqContext(http.MethodDelete, "/api/user/tokens/abc", "", map[string]string{":uid": "abc"}, "")
		require.Equal(t, http.StatusOK, hs.RevokeUserPersonalAccessToken(c).Status())
		require.Equal(t, patstore.ReasonUser, svc.reason)
		require.Equal(t, int64(7), svc.revokedFor)

		c = patReqContext(http.MethodDelete, "/api/users/9/tokens/abc", "", map[string]string{":id": "9", ":uid": "abc"}, "")
		require.Equal(t, http.StatusOK, hs.AdminRevokeUserPersonalAccessToken(c).Status())
		require.Equal(t, patstore.ReasonAdmin, svc.reason)
		require.Equal(t, int64(9), svc.revokedFor)

		c = patReqContext(http.MethodDelete, "/api/users/x/tokens/abc", "", map[string]string{":id": "x", ":uid": "abc"}, "")
		require.Equal(t, http.StatusBadRequest, hs.AdminRevokeUserPersonalAccessToken(c).Status())
	})
}

func TestPersonalAccessTokenPolicyHandlers(t *testing.T) {
	newHS := func(override bool) *HTTPServer {
		cfg := setting.NewCfg()
		cfg.PersonalAccessTokens.AllowRuntimeOverride = override
		return &HTTPServer{personalTokenPolicy: patpolicy.ProvideService(kvstore.NewFakeKVStore(), patstore.Store(nil), cfg)}
	}

	t.Run("instance switch toggles and org narrows", func(t *testing.T) {
		hs := newHS(true)
		c := patReqContext(http.MethodPut, "/api/admin/settings/personal-access-tokens", `{"enabled":true}`, nil, "")
		require.Equal(t, http.StatusOK, hs.UpdateInstancePersonalAccessTokenPolicy(c).Status())
		res := hs.GetInstancePersonalAccessTokenPolicy(c)
		require.JSONEq(t, `{"enabled":true,"managedByConfig":false}`, string(res.Body()))

		c = patReqContext(http.MethodPut, "/api/org/settings/personal-access-tokens", `{"enabled":false}`, nil, "")
		require.Equal(t, http.StatusOK, hs.UpdateOrgPersonalAccessTokenPolicy(c).Status())
		require.JSONEq(t, `{"enabled":false,"managedByConfig":false}`, string(hs.GetOrgPersonalAccessTokenPolicy(c).Body()))
		require.JSONEq(t, `{"enabled":false,"managedByConfig":false}`, string(hs.GetEffectivePersonalAccessTokenPolicy(c).Body()))
	})

	t.Run("config managed instance switch is read-only", func(t *testing.T) {
		hs := newHS(false)
		c := patReqContext(http.MethodPut, "/api/admin/settings/personal-access-tokens", `{"enabled":true}`, nil, "")
		require.Equal(t, http.StatusForbidden, hs.UpdateInstancePersonalAccessTokenPolicy(c).Status())
	})
}

func TestPersonalAccessTokenAdminSearch(t *testing.T) {
	svc := &fakePATService{}
	hs := &HTTPServer{personalTokenService: svc}

	t.Run("scoped to the current org by default", func(t *testing.T) {
		c := patReqContext(http.MethodGet, "/api/personal-access-tokens?query=bob&status=active&page=2&perpage=10", "", nil, "")
		res := hs.SearchPersonalAccessTokens(c)
		require.Equal(t, http.StatusOK, res.Status())
		require.Equal(t, patstore.SearchQuery{OrgID: 1, Query: "bob", Status: "active", Page: 2, Limit: 10}, svc.query)
		var out SearchPersonalAccessTokensResponse
		require.NoError(t, json.Unmarshal(res.Body(), &out))
		require.Equal(t, "bob", out.Tokens[0].OwnerLogin)
		require.EqualValues(t, 1, out.Total)
	})

	t.Run("instance-wide scope needs a server admin", func(t *testing.T) {
		c := patReqContext(http.MethodGet, "/api/personal-access-tokens?scope=all", "", nil, "")
		require.Equal(t, http.StatusForbidden, hs.SearchPersonalAccessTokens(c).Status())
		c.SignedInUser.IsGrafanaAdmin = true
		require.Equal(t, http.StatusOK, hs.SearchPersonalAccessTokens(c).Status())
		require.Zero(t, svc.query.OrgID)
	})

	t.Run("passes a whitelisted sort to the store", func(t *testing.T) {
		c := patReqContext(http.MethodGet, "/api/personal-access-tokens?sort=expires&order=desc", "", nil, "")
		require.Equal(t, http.StatusOK, hs.SearchPersonalAccessTokens(c).Status())
		require.Equal(t, "expires", svc.query.SortBy)
		require.True(t, svc.query.SortDesc)
	})

	t.Run("rejects bad filters", func(t *testing.T) {
		for _, q := range []string{"status=bogus", "userId=x", "expiringBefore=yesterday", "sort=hash", "order=sideways"} {
			c := patReqContext(http.MethodGet, "/api/personal-access-tokens?"+q, "", nil, "")
			require.Equal(t, http.StatusBadRequest, hs.SearchPersonalAccessTokens(c).Status(), q)
		}
	})

	t.Run("revoke by uid stays in the org unless server admin passes scope=all", func(t *testing.T) {
		c := patReqContext(http.MethodDelete, "/api/personal-access-tokens/u1", "", map[string]string{":uid": "u1"}, "")
		require.Equal(t, http.StatusOK, hs.RevokePersonalAccessTokenByUID(c).Status())
		require.EqualValues(t, 1, svc.revokedOrg)
		c = patReqContext(http.MethodDelete, "/api/personal-access-tokens/u1?scope=all", "", map[string]string{":uid": "u1"}, "")
		require.Equal(t, http.StatusForbidden, hs.RevokePersonalAccessTokenByUID(c).Status())
	})
}
