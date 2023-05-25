package settingsprovider

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"gopkg.in/ini.v1"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/extensions/testcommon"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/settings"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func setupServerAndIntegration(t *testing.T) (*web.Mux, *Implementation) {
	t.Helper()
	m := web.New()
	m.Use(testcommon.GetContextHandler(t).Middleware)
	cfg := &setting.Cfg{Raw: &ini.File{}}
	s := &Implementation{
		FileCfg:       cfg,
		db:            &fakeStore{},
		AccessControl: accesscontrolmock.New().WithDisabled(),
	}
	return m, s
}

func TestAuth_AdminUpsertSettings(t *testing.T) {
	t.Run("it returns 400 when no updates neither removals provided", func(t *testing.T) {
		m, s := setupServerAndIntegration(t)
		m.Put(updateSettingsPath, routing.Wrap(s.AdminUpsertSettings))

		resp, err := putUpdateSettings(m, bytes.NewReader([]byte(`{}`)))
		require.NoError(t, err)

		assert.Equal(t, http.StatusBadRequest, resp.Code)
	})

	t.Run("it returns 400 when invalid settings provided", func(t *testing.T) {
		m, s := setupServerAndIntegration(t)
		m.Put(updateSettingsPath, routing.Wrap(s.AdminUpsertSettings))
		errReloadHandler := &fakeReloadHandler{err: errors.New("invalid settings")}
		s.reloadHandlers = map[string][]setting.ReloadHandler{"auth.saml": {errReloadHandler}}
		fakeStore := &fakeStore{settings: []settings.Setting{}}
		s.db = fakeStore

		resp, err := putUpdateSettings(m, bytes.NewReader([]byte(`{"updates": { "auth.saml": {"enabled": "ko"}}}`)))
		require.NoError(t, err)

		assert.Equal(t, http.StatusBadRequest, resp.Code)

		// Handler validated but not reloaded
		assert.True(t, errReloadHandler.validated)
		assert.False(t, errReloadHandler.reloaded)

		// Database settings not updated when invalid
		assert.EqualValues(t, []settings.Setting{}, fakeStore.settings)
	})

	t.Run("it returns 403 when not allowed settings provided", func(t *testing.T) {
		m, s := setupServerAndIntegration(t)
		m.Put(updateSettingsPath, routing.Wrap(s.AdminUpsertSettings))
		fakeStore := &fakeStore{settings: []settings.Setting{}}
		s.db = fakeStore

		resp, err := putUpdateSettings(m, bytes.NewReader([]byte(`{"updates": { "saml.auth": {"enabled": "ko"}}}`)))
		require.NoError(t, err)

		assert.Equal(t, http.StatusForbidden, resp.Code)

		// Database settings not updated when forbidden
		assert.EqualValues(t, []settings.Setting{}, fakeStore.settings)
	})

	t.Run("it returns 500 when a database error happened", func(t *testing.T) {
		m, s := setupServerAndIntegration(t)
		m.Put(updateSettingsPath, routing.Wrap(s.AdminUpsertSettings))
		s.db = &fakeStore{err: errors.New("database error")}

		resp, err := putUpdateSettings(m, bytes.NewReader([]byte(`{"updates": { "auth.saml": {"enabled": "true"}}}`)))
		require.NoError(t, err)

		assert.Equal(t, http.StatusInternalServerError, resp.Code)
	})

	t.Run("it returns 200 when settings updated and services reloaded successfully", func(t *testing.T) {
		m, s := setupServerAndIntegration(t)
		m.Put(updateSettingsPath, routing.Wrap(s.AdminUpsertSettings))
		fakeReloadHandler := &fakeReloadHandler{}
		s.reloadHandlers = map[string][]setting.ReloadHandler{"auth.saml": {fakeReloadHandler}}
		fakeStore := &fakeStore{settings: []settings.Setting{{Section: "auth.saml", Key: "enabled", Value: "false"}}}
		s.db = fakeStore
		s.settings = map[string]map[string]string{"auth.saml": {"enabled": "false"}}

		resp, err := putUpdateSettings(m, bytes.NewReader([]byte(`{"updates": { "auth.saml": {"enabled": "true"}}}`)))
		require.NoError(t, err)

		assert.Equal(t, http.StatusOK, resp.Code)

		// Handler validated and reloaded
		assert.True(t, fakeReloadHandler.validated)
		assert.True(t, fakeReloadHandler.reloaded)

		// In-memory settings updated
		assert.EqualValues(t, map[string]map[string]string{"auth.saml": {"enabled": "true"}}, s.settings)

		// Database settings updated
		assert.EqualValues(t, []settings.Setting{{Section: "auth.saml", Key: "enabled", Value: "true"}}, fakeStore.settings)
	})

	t.Run("it returns 200 when settings removed and services reloaded successfully", func(t *testing.T) {
		m, s := setupServerAndIntegration(t)
		m.Put(updateSettingsPath, routing.Wrap(s.AdminUpsertSettings))
		fakeReloadHandler := &fakeReloadHandler{}
		s.reloadHandlers = map[string][]setting.ReloadHandler{"auth.saml": {fakeReloadHandler}}
		fakeStore := &fakeStore{settings: []settings.Setting{{Section: "auth.saml", Key: "enabled", Value: "false"}}}
		s.db = fakeStore
		s.settings = map[string]map[string]string{"auth.saml": {"enabled": "false"}}

		resp, err := putUpdateSettings(m, bytes.NewReader([]byte(`{"removals": { "auth.saml": ["enabled"] }}`)))
		require.NoError(t, err)

		assert.Equal(t, http.StatusOK, resp.Code)

		// Handler validated and reloaded
		assert.True(t, fakeReloadHandler.validated)
		assert.True(t, fakeReloadHandler.reloaded)

		// In-memory settings updated
		assert.EqualValues(t, map[string]map[string]string{}, s.settings)

		// Database settings updated
		assert.EqualValues(t, []settings.Setting{}, fakeStore.settings)
	})

	t.Run("it returns 200 when settings updated but no reloads needed", func(t *testing.T) {
		m, s := setupServerAndIntegration(t)
		m.Put(updateSettingsPath, routing.Wrap(s.AdminUpsertSettings))
		fakeReloadHandler := &fakeReloadHandler{}
		s.reloadHandlers = map[string][]setting.ReloadHandler{"auth.saml": {fakeReloadHandler}}
		fakeStore := &fakeStore{settings: []settings.Setting{}}
		s.db = fakeStore
		s.settings = map[string]map[string]string{"auth.saml": {"enabled": "true"}}

		resp, err := putUpdateSettings(m, bytes.NewReader([]byte(`{"updates": { "auth.saml": {"enabled": "true"}}}`)))
		require.NoError(t, err)

		assert.Equal(t, http.StatusOK, resp.Code)

		// Handler validated and reloaded
		assert.False(t, fakeReloadHandler.validated)
		assert.False(t, fakeReloadHandler.reloaded)

		// In-memory settings updated
		assert.EqualValues(t, map[string]map[string]string{"auth.saml": {"enabled": "true"}}, s.settings)

		// Database settings updated
		assert.EqualValues(t, []settings.Setting{{Section: "auth.saml", Key: "enabled", Value: "true"}}, fakeStore.settings)
	})

	t.Run("it returns 200 when settings removed but no reloads needed", func(t *testing.T) {
		m, s := setupServerAndIntegration(t)
		m.Put(updateSettingsPath, routing.Wrap(s.AdminUpsertSettings))
		fakeReloadHandler := &fakeReloadHandler{}
		s.reloadHandlers = map[string][]setting.ReloadHandler{"auth.saml": {fakeReloadHandler}}
		fakeStore := &fakeStore{settings: []settings.Setting{{Section: "auth.saml", Key: "enabled", Value: "false"}}}
		s.db = fakeStore
		s.settings = map[string]map[string]string{}

		resp, err := putUpdateSettings(m, bytes.NewReader([]byte(`{"removals": { "auth.saml": ["enabled"] }}`)))
		require.NoError(t, err)

		assert.Equal(t, http.StatusOK, resp.Code)

		// Handler validated and reloaded
		assert.False(t, fakeReloadHandler.validated)
		assert.False(t, fakeReloadHandler.reloaded)

		// In-memory settings updated
		assert.EqualValues(t, map[string]map[string]string{}, s.settings)

		// Database settings updated
		assert.EqualValues(t, []settings.Setting{}, fakeStore.settings)
	})
}

func TestImplementation_AdminUpsertSettings(t *testing.T) {
	type adminUpsertSettingsTestCase struct {
		desc         string
		expectedCode int
		cmd          *settings.UpsertSettingsCommand
		user         *user.SignedInUser
		permissions  []accesscontrol.Permission
	}

	tests := []adminUpsertSettingsTestCase{
		{
			desc:         "it returns 200 for action settings:write and scope settings:*",
			expectedCode: http.StatusOK,
			cmd: &settings.UpsertSettingsCommand{
				Updates:  setting.SettingsBag{"auth.saml": {"enabled": "true"}},
				Removals: setting.SettingsRemovals{"auth.saml": {"max_issue_delay"}},
			},
			permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionSettingsWrite,
					Scope:  accesscontrol.ScopeSettingsAll,
				},
			},
		},
		{
			desc:         "it returns 200 for action settings:write and scope settings:auth.saml:*",
			expectedCode: http.StatusOK,
			cmd: &settings.UpsertSettingsCommand{
				Updates:  setting.SettingsBag{"auth.saml": {"enabled": "true"}},
				Removals: setting.SettingsRemovals{"auth.saml": {"max_issue_delay"}},
			},
			permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionSettingsWrite,
					Scope:  "settings:auth.saml:*",
				},
			},
		},
		{
			desc:         "it returns 401 when assigned role is higher than request role",
			expectedCode: http.StatusUnauthorized,
			cmd: &settings.UpsertSettingsCommand{
				Updates: setting.SettingsBag{"auth.saml": {"role_values_grafana_admin": "bob"}},
			},
			user: &user.SignedInUser{
				OrgRole: roletype.RoleAdmin,
			},
			permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionSettingsWrite,
					Scope:  "settings:auth.saml:*",
				},
			},
		},
		{
			desc:         "it returns 200 when assigned role is higher than request role and user is a gadmin",
			expectedCode: http.StatusOK,
			cmd: &settings.UpsertSettingsCommand{
				Updates: setting.SettingsBag{"auth.saml": {"role_values_grafana_admin": "bob"}},
			},
			user: &user.SignedInUser{
				OrgRole:        roletype.RoleAdmin,
				IsGrafanaAdmin: true,
			},
			permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionSettingsWrite,
					Scope:  "settings:auth.saml:*",
				},
			},
		},
		{
			desc:         "it returns 400 when bad value is passed",
			expectedCode: http.StatusOK,
			cmd: &settings.UpsertSettingsCommand{
				Updates: setting.SettingsBag{"auth.saml": {"role_values_bad_value": "bob"}},
			},
			user: &user.SignedInUser{
				OrgRole:        roletype.RoleAdmin,
				IsGrafanaAdmin: true,
			},
			permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionSettingsWrite,
					Scope:  "settings:auth.saml:*",
				},
			},
		},
		{
			desc:         "it returns 401 when assigned role is higher than request org_mapping",
			expectedCode: http.StatusUnauthorized,
			cmd: &settings.UpsertSettingsCommand{
				Updates: setting.SettingsBag{"auth.saml": {"org_mapping": "admin:1:Admin, editor:1:Editor, viewer:1:Viewer"}},
			},
			user: &user.SignedInUser{
				OrgRole: roletype.RoleEditor,
			},
			permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionSettingsWrite,
					Scope:  "settings:auth.saml:*",
				},
			},
		},
		{
			desc:         "it returns 400 when bad role value is passed",
			expectedCode: http.StatusBadRequest,
			cmd: &settings.UpsertSettingsCommand{
				Updates: setting.SettingsBag{"auth.saml": {"role_values_bob": "Admin"}},
			},
			user: &user.SignedInUser{
				OrgRole: roletype.RoleEditor,
			},
			permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionSettingsWrite,
					Scope:  "settings:auth.saml:*",
				},
			},
		},
		{
			desc:         "it returns 401 when an Editor tries to update Admin mapping",
			expectedCode: http.StatusUnauthorized,
			cmd: &settings.UpsertSettingsCommand{
				Updates: setting.SettingsBag{"auth.saml": {"role_values_admin": "bob"}},
			},
			user: &user.SignedInUser{
				OrgRole: roletype.RoleEditor,
			},
			permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionSettingsWrite,
					Scope:  "settings:auth.saml:*",
				},
			},
		},
		{
			desc:         "it returns 401 when using org_mapping. reserved to gadmin",
			expectedCode: http.StatusUnauthorized,
			cmd: &settings.UpsertSettingsCommand{
				Updates: setting.SettingsBag{"auth.saml": {"org_mapping": "admin:1:Admin, editor:1:Editor, viewer:1:Viewer"}},
			},
			user: &user.SignedInUser{
				OrgRole: roletype.RoleAdmin,
			},
			permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionSettingsWrite,
					Scope:  "settings:auth.saml:*",
				},
			},
		},
		{
			desc:         "it returns 200 for action settings:write in combination with scope settings:auth.saml:enabled and scope settings:auth.saml:max_issue_delay",
			expectedCode: http.StatusOK,
			cmd: &settings.UpsertSettingsCommand{
				Updates:  setting.SettingsBag{"auth.saml": {"enabled": "true"}},
				Removals: setting.SettingsRemovals{"auth.saml": {"max_issue_delay"}},
			},
			permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionSettingsWrite,
					Scope:  "settings:auth.saml:enabled",
				},
				{
					Action: accesscontrol.ActionSettingsWrite,
					Scope:  "settings:auth.saml:max_issue_delay",
				},
			},
		},
		{
			desc:         "it returns 403 when missing permissions",
			expectedCode: http.StatusForbidden,
			cmd: &settings.UpsertSettingsCommand{
				Updates:  setting.SettingsBag{"auth.saml": {"enabled": "true"}},
				Removals: setting.SettingsRemovals{"auth.saml": {"max_issue_delay"}},
			},
			permissions: []accesscontrol.Permission{},
		},
		{
			desc:         "it returns 403 when partially missing scope",
			expectedCode: http.StatusForbidden,
			cmd: &settings.UpsertSettingsCommand{
				Updates: setting.SettingsBag{"auth.saml": {"enabled": "true", "max_issue_delay": "1"}},
			},
			permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionSettingsWrite,
					Scope:  "settings:auth.saml:enabled",
				},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.desc, func(t *testing.T) {
			routeRegister := routing.NewRouteRegister()
			cfg := setting.NewCfg()
			s := &Implementation{
				FileCfg:       cfg,
				RouteRegister: routeRegister,
				db:            &fakeStore{},
				AccessControl: accesscontrolmock.New().WithPermissions(tc.permissions),
			}

			s.registerEndpoints()
			m := webtest.NewServer(t, routeRegister)

			body, err := json.Marshal(tc.cmd)
			require.NoError(t, err)

			if tc.user == nil {
				tc.user = &user.SignedInUser{}
			}
			reader := bytes.NewReader(body)
			resp, err := putWebTestUpdateSettings(m, tc.user, reader)
			defer func() { _ = resp.Body.Close() }()
			require.NoError(t, err)
			require.Equal(t, tc.expectedCode, resp.StatusCode)
		})
	}
}
func putWebTestUpdateSettings(m *webtest.Server, user *user.SignedInUser, reqBody io.Reader) (*http.Response, error) {
	req := m.NewRequest(http.MethodPut, updateSettingsPath, reqBody)
	webtest.RequestWithSignedInUser(req, user)
	resp, err := m.SendJSON(req)
	return resp, err
}

func putUpdateSettings(m *web.Mux, reqBody io.Reader) (*httptest.ResponseRecorder, error) {
	resp := httptest.NewRecorder()
	req, err := http.NewRequest(http.MethodPut, updateSettingsPath, reqBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	m.ServeHTTP(resp, req)
	return resp, nil
}

type fakeStore struct {
	settings []settings.Setting
	err      error
}

func (fs *fakeStore) GetSettings() ([]settings.Setting, error) {
	return fs.settings, fs.err
}

func (fs *fakeStore) UpsertSettings(updates setting.SettingsBag, removals setting.SettingsRemovals) error {
	for section, keyValues := range updates {
		for key, value := range keyValues {
			fs.upsert(section, key, value)
		}
	}

	for section, keysToRemove := range removals {
		for _, key := range keysToRemove {
			fs.remove(section, key)
		}
	}

	return fs.err
}

func (fs *fakeStore) upsert(section, key, value string) {
	for i, s := range fs.settings {
		if s.Section == section && s.Key == key {
			fs.settings[i].Value = value
			return
		}
	}

	fs.settings = append(fs.settings, settings.Setting{Section: section, Key: key, Value: value})
}

func (fs *fakeStore) remove(section, key string) {
	for i, s := range fs.settings {
		if s.Section == section && s.Key == key {
			fs.settings = append(fs.settings[:i], fs.settings[i+1:]...)
			return
		}
	}
}

type fakeReloadHandler struct {
	err       error
	validated bool
	reloaded  bool
}

func (h *fakeReloadHandler) Validate(_ setting.Section) error {
	h.validated = true
	return h.err
}

func (h *fakeReloadHandler) Reload(_ setting.Section) error {
	h.reloaded = true
	return h.err
}
