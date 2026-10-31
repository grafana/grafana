package tokenexchange

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	v3 "github.com/grafana/grafana/pkg/plugins/backendplugin/v3"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type appSettingsLookup func(context.Context, *pluginsettings.GetByPluginIDArgs) (*pluginsettings.DTO, error)

func (f appSettingsLookup) GetPluginSettingByPluginID(ctx context.Context, q *pluginsettings.GetByPluginIDArgs) (*pluginsettings.DTO, error) {
	return f(ctx, q)
}

func TestSubjectSigningAppEnablement(t *testing.T) {
	credential, err := v3.IssueLocalAccessPolicyToken("allowed-app", testManifest)
	require.NoError(t, err)
	t.Cleanup(func() { v3.RevokeLocalAccessPolicyToken(credential) })
	for _, tt := range []struct {
		name        string
		autoEnabled bool
		settings    map[int64]bool
		settingsErr error
		missing     bool
		notApp      bool
		status      int
	}{
		{name: "enabled in target org only", settings: map[int64]bool{1: false, 2: true}, status: http.StatusOK},
		{name: "disabled in target org", settings: map[int64]bool{1: true, 2: false}, status: http.StatusForbidden},
		{name: "no setting in target org", settings: map[int64]bool{1: true}, status: http.StatusForbidden},
		{name: "auto enabled without setting", autoEnabled: true, status: http.StatusOK},
		{name: "auto enabled with enabled setting", autoEnabled: true, settings: map[int64]bool{2: true}, status: http.StatusOK},
		{name: "auto enabled with disabled setting", autoEnabled: true, settings: map[int64]bool{2: false}, status: http.StatusForbidden},
		{name: "settings unavailable", settingsErr: errors.New("database unavailable"), status: http.StatusInternalServerError},
		{name: "auto enabled settings unavailable", autoEnabled: true, settingsErr: errors.New("database unavailable"), status: http.StatusInternalServerError},
		{name: "plugin removed", missing: true, status: http.StatusForbidden},
		{name: "not an app", notApp: true, status: http.StatusForbidden},
	} {
		t.Run(tt.name, func(t *testing.T) {
			p := pluginstore.Plugin{JSONData: plugins.JSONData{ID: "allowed-app", Type: plugins.TypeApp, AutoEnabled: tt.autoEnabled}}
			if tt.notApp {
				p.Type = plugins.TypeDataSource
			}
			store := pluginstore.NewFakePluginStore(p)
			if tt.missing {
				store.PluginList = nil
			}
			settingsCalls, accountCalls := 0, 0
			s := &Service{
				cfg: &setting.Cfg{ExtJWTAuth: setting.ExtJWTSettings{Audiences: []string{"grafana"}}}, log: log.NewNopLogger(),
				subjectPolicies: map[string]*v3.LocalSubjectPolicy{"allowed-app": {DelegatedPermissions: []string{"datasources:read"}}},
				plugins:         store,
				pluginSettings: appSettingsLookup(func(_ context.Context, q *pluginsettings.GetByPluginIDArgs) (*pluginsettings.DTO, error) {
					settingsCalls++
					require.Equal(t, &pluginsettings.GetByPluginIDArgs{OrgID: 2, PluginID: "allowed-app"}, q)
					if tt.settingsErr != nil {
						return nil, tt.settingsErr
					}
					if enabled, ok := tt.settings[q.OrgID]; ok {
						return &pluginsettings.DTO{Enabled: enabled}, nil
					}
					return nil, pluginsettings.ErrPluginSettingNotFound
				}),
				users: subjectLookup(func(_ context.Context, q *user.GetSignedInUserQuery) (*user.SignedInUser, error) {
					accountCalls++
					require.Equal(t, &user.GetSignedInUserQuery{UserID: 42, UserUID: "uid-42", OrgID: 2}, q)
					return &user.SignedInUser{UserID: 42, UserUID: "uid-42", OrgID: 2}, nil
				}),
			}
			call := func(want int) {
				req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"namespace":"org-2","audiences":["grafana"],"subject":{"sub":"user:42","identifier":"uid-42","type":"user","namespace":"org-2"}}`))
				req.Header.Set("Authorization", "Bearer "+credential)
				req.Header.Set("X-Grafana-Org-Id", "1")
				rec := httptest.NewRecorder()
				c := &contextmodel.ReqContext{
					Context:      &web.Context{Req: req, Resp: web.NewResponseWriter(req.Method, rec)},
					SignedInUser: &user.SignedInUser{OrgID: 1},
				}
				s.signAccessToken(c).WriteTo(c)
				require.Equal(t, want, rec.Code, rec.Body.String())
				var result exchangeResponse
				require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &result))
				if want != http.StatusOK {
					require.Nil(t, result.Data)
					return
				}
				keys, err := v3.LocalKeyRetriever()
				require.NoError(t, err)
				claims, err := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{"grafana"}}, keys).Verify(context.Background(), result.Data.Token)
				require.NoError(t, err)
				require.Equal(t, "org-2", claims.Rest.Namespace)
				require.Equal(t, "org-2", claims.Rest.Actor.Namespace)
			}
			call(tt.status)
			if tt.missing || tt.notApp {
				require.Zero(t, settingsCalls)
			} else {
				require.Equal(t, 1, settingsCalls)
			}
			if tt.status != http.StatusOK {
				require.Zero(t, accountCalls)
				return
			}
			require.Equal(t, 1, accountCalls)
			// Every fresh exchange checks current settings, including auto-enabled apps.
			tt.settings = map[int64]bool{2: false}
			call(http.StatusForbidden)
			require.Equal(t, 2, settingsCalls)
			require.Equal(t, 1, accountCalls)
		})
	}
}

func TestSubjectSigningRejectsNoncanonicalOrganization(t *testing.T) {
	// No plugin/account dependencies: invalid namespaces must be rejected before lookup.
	s := &Service{}
	for _, namespace := range []string{"", "*", "stacks-2", "org-1", "org-02", "org-0", "org--1"} {
		t.Run(namespace, func(t *testing.T) {
			require.ErrorIs(t, s.validateAppEnabled(context.Background(), "allowed-app", namespace), v3.ErrLocalAccessDenied)
		})
	}
}

func TestIncompleteSubjectRequestDoesNotResolveAppOrAccount(t *testing.T) {
	credential, err := v3.IssueLocalAccessPolicyToken("allowed-app", testManifest)
	require.NoError(t, err)
	t.Cleanup(func() { v3.RevokeLocalAccessPolicyToken(credential) })
	s := &Service{
		cfg: &setting.Cfg{ExtJWTAuth: setting.ExtJWTSettings{Audiences: []string{"grafana"}}}, log: log.NewNopLogger(),
		subjectPolicies: map[string]*v3.LocalSubjectPolicy{"allowed-app": {DelegatedPermissions: []string{"datasources:read"}}},
	}
	for _, body := range []string{
		`{"audiences":["grafana"],"subject":{"namespace":"default","sub":"user:42","identifier":"uid-42","type":"user"}}`,
		`{"namespace":"default","subject":{"namespace":"default","sub":"user:42","identifier":"uid-42","type":"user"}}`,
	} {
		t.Run(body, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
			req.Header.Set("Authorization", "Bearer "+credential)
			rec := httptest.NewRecorder()
			c := &contextmodel.ReqContext{Context: &web.Context{Req: req, Resp: web.NewResponseWriter(req.Method, rec)}}
			s.signAccessToken(c).WriteTo(c)
			require.Equal(t, http.StatusBadRequest, rec.Code)
			require.JSONEq(t, `{"status":"error","error":"local plugin token exchange: namespace and audiences are required"}`, rec.Body.String())
		})
	}
}
