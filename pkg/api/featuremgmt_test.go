package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetFeatureToggles(t *testing.T) {
	readPermissions := []accesscontrol.Permission{{Action: accesscontrol.ActionFeatureManagementRead}}

	t.Run("should not be able to get feature toggles without permissions", func(t *testing.T) {
		result := runGetScenario(t, []*featuremgmt.FeatureFlag{}, setting.FeatureMgmtSettings{}, []accesscontrol.Permission{}, http.StatusForbidden)
		assert.Len(t, result, 0)
	})

	t.Run("should be able to get feature toggles with correct permissions", func(t *testing.T) {
		features := []*featuremgmt.FeatureFlag{
			{
				Name:    "toggle1",
				Enabled: true,
				Stage:   featuremgmt.FeatureStageGeneralAvailability,
			}, {
				Name:    "toggle2",
				Enabled: false,
				Stage:   featuremgmt.FeatureStageGeneralAvailability,
			},
		}

		result := runGetScenario(t, features, setting.FeatureMgmtSettings{}, readPermissions, http.StatusOK)
		assert.Len(t, result, 2)
		t1, _ := findResult(t, result, "toggle1")
		assert.True(t, t1.Enabled)
		t2, _ := findResult(t, result, "toggle2")
		assert.False(t, t2.Enabled)
	})

	t.Run("toggles hidden by config are not present in the response", func(t *testing.T) {
		features := []*featuremgmt.FeatureFlag{
			{
				Name:    "toggle1",
				Enabled: true,
				Stage:   featuremgmt.FeatureStageGeneralAvailability,
			}, {
				Name:    "toggle2",
				Enabled: false,
				Stage:   featuremgmt.FeatureStageGeneralAvailability,
			},
		}
		settings := setting.FeatureMgmtSettings{
			HiddenToggles: map[string]struct{}{"toggle1": {}},
		}

		result := runGetScenario(t, features, settings, readPermissions, http.StatusOK)
		assert.Len(t, result, 1)
		assert.Equal(t, "toggle2", result[0].Name)
	})

	t.Run("toggles that are read-only by config have the readOnly field set", func(t *testing.T) {
		features := []*featuremgmt.FeatureFlag{
			{
				Name:    "toggle1",
				Enabled: true,
				Stage:   featuremgmt.FeatureStageGeneralAvailability,
			}, {
				Name:    "toggle2",
				Enabled: false,
				Stage:   featuremgmt.FeatureStageGeneralAvailability,
			},
		}
		settings := setting.FeatureMgmtSettings{
			HiddenToggles:   map[string]struct{}{"toggle1": {}},
			ReadOnlyToggles: map[string]struct{}{"toggle2": {}},
			AllowEditing:    true,
			UpdateWebhook:   "bogus",
		}

		result := runGetScenario(t, features, settings, readPermissions, http.StatusOK)
		assert.Len(t, result, 1)
		assert.Equal(t, "toggle2", result[0].Name)
		assert.True(t, result[0].ReadOnly)
	})

	t.Run("feature toggle defailts", func(t *testing.T) {
		features := []*featuremgmt.FeatureFlag{
			{
				Name:  "toggle1",
				Stage: featuremgmt.FeatureStageUnknown,
			}, {
				Name:  "toggle2",
				Stage: featuremgmt.FeatureStageExperimental,
			}, {
				Name:  "toggle3",
				Stage: featuremgmt.FeatureStagePrivatePreview,
			}, {
				Name:  "toggle4",
				Stage: featuremgmt.FeatureStagePublicPreview,
			}, {
				Name:  "toggle5",
				Stage: featuremgmt.FeatureStageGeneralAvailability,
			}, {
				Name:  "toggle6",
				Stage: featuremgmt.FeatureStageDeprecated,
			},
		}

		t.Run("unknown, experimental, and private preview toggles are hidden by default", func(t *testing.T) {
			result := runGetScenario(t, features, setting.FeatureMgmtSettings{}, readPermissions, http.StatusOK)
			assert.Len(t, result, 3)

			_, ok := findResult(t, result, "toggle1")
			assert.False(t, ok)
			_, ok = findResult(t, result, "toggle2")
			assert.False(t, ok)
			_, ok = findResult(t, result, "toggle3")
			assert.False(t, ok)
		})

		t.Run("only public preview and GA are writeable by default", func(t *testing.T) {
			settings := setting.FeatureMgmtSettings{
				AllowEditing:  true,
				UpdateWebhook: "bogus",
			}
			result := runGetScenario(t, features, settings, readPermissions, http.StatusOK)
			assert.Len(t, result, 3)

			t4, ok := findResult(t, result, "toggle4")
			assert.True(t, ok)
			assert.True(t, t4.ReadOnly)
			t5, ok := findResult(t, result, "toggle5")
			assert.True(t, ok)
			assert.False(t, t5.ReadOnly)
			t6, ok := findResult(t, result, "toggle6")
			assert.True(t, ok)
			assert.False(t, t6.ReadOnly)
		})

		t.Run("all toggles are read-only when server is misconfigured", func(t *testing.T) {
			settings := setting.FeatureMgmtSettings{
				AllowEditing:  false,
				UpdateWebhook: "",
			}
			result := runGetScenario(t, features, settings, readPermissions, http.StatusOK)
			assert.Len(t, result, 3)

			t4, ok := findResult(t, result, "toggle4")
			assert.True(t, ok)
			assert.True(t, t4.ReadOnly)
			t5, ok := findResult(t, result, "toggle5")
			assert.True(t, ok)
			assert.True(t, t5.ReadOnly)
			t6, ok := findResult(t, result, "toggle6")
			assert.True(t, ok)
			assert.True(t, t6.ReadOnly)
		})
	})
}

func TestSetFeatureToggles(t *testing.T) {
	writePermissions := []accesscontrol.Permission{{Action: accesscontrol.ActionFeatureManagementWrite}}

	t.Run("fails without adequate permissions", func(t *testing.T) {
		res := runSetScenario(t, nil, nil, setting.FeatureMgmtSettings{}, []accesscontrol.Permission{}, http.StatusForbidden)
		defer func() { require.NoError(t, res.Body.Close()) }()
	})

	t.Run("fails when toggle editing is not enabled", func(t *testing.T) {
		res := runSetScenario(t, nil, nil, setting.FeatureMgmtSettings{}, writePermissions, http.StatusForbidden)
		defer func() { require.NoError(t, res.Body.Close()) }()
		p := readBody(t, res.Body)
		assert.Equal(t, "feature toggles are read-only", p["message"])
	})

	t.Run("fails when update toggle url is not set", func(t *testing.T) {
		s := setting.FeatureMgmtSettings{
			AllowEditing: true,
		}
		res := runSetScenario(t, nil, nil, s, writePermissions, http.StatusInternalServerError)
		defer func() { require.NoError(t, res.Body.Close()) }()
		p := readBody(t, res.Body)
		assert.Equal(t, "feature toggles service is misconfigured", p["message"])
	})

	t.Run("fails with non-existent toggle", func(t *testing.T) {
		features := []*featuremgmt.FeatureFlag{
			{
				Name:    "toggle1",
				Enabled: true,
				Stage:   featuremgmt.FeatureStageGeneralAvailability,
			}, {
				Name:    "toggle2",
				Enabled: false,
				Stage:   featuremgmt.FeatureStageGeneralAvailability,
			},
		}

		updates := []featuremgmt.FeatureToggleDTO{
			{
				Name:    "toggle3",
				Enabled: true,
			},
		}

		s := setting.FeatureMgmtSettings{
			AllowEditing:  true,
			UpdateWebhook: "random",
		}
		res := runSetScenario(t, features, updates, s, writePermissions, http.StatusBadRequest)
		defer func() { require.NoError(t, res.Body.Close()) }()
		p := readBody(t, res.Body)
		assert.Equal(t, "invalid toggle passed in", p["message"])
	})

	t.Run("fails with read-only toggles", func(t *testing.T) {
		features := []*featuremgmt.FeatureFlag{
			{
				Name:    featuremgmt.FlagFeatureToggleAdminPage,
				Enabled: true,
				Stage:   featuremgmt.FeatureStageGeneralAvailability,
			}, {
				Name:    "toggle2",
				Enabled: false,
				Stage:   featuremgmt.FeatureStagePublicPreview,
			}, {
				Name:    "toggle3",
				Enabled: false,
				Stage:   featuremgmt.FeatureStageGeneralAvailability,
			},
		}

		s := setting.FeatureMgmtSettings{
			AllowEditing:  true,
			UpdateWebhook: "random",
			ReadOnlyToggles: map[string]struct{}{
				"toggle3": {},
			},
		}

		t.Run("because it is the feature toggle admin page toggle", func(t *testing.T) {
			updates := []featuremgmt.FeatureToggleDTO{
				{
					Name:    featuremgmt.FlagFeatureToggleAdminPage,
					Enabled: true,
				},
			}
			res := runSetScenario(t, features, updates, s, writePermissions, http.StatusBadRequest)
			defer func() { require.NoError(t, res.Body.Close()) }()
			p := readBody(t, res.Body)
			assert.Equal(t, fmt.Sprintf("invalid toggle passed in: %s", featuremgmt.FlagFeatureToggleAdminPage), p["error"])
		})

		t.Run("because it is not GA or Deprecated", func(t *testing.T) {
			updates := []featuremgmt.FeatureToggleDTO{
				{
					Name:    "toggle2",
					Enabled: true,
				},
			}
			res := runSetScenario(t, features, updates, s, writePermissions, http.StatusBadRequest)
			defer func() { require.NoError(t, res.Body.Close()) }()
			p := readBody(t, res.Body)
			assert.Equal(t, "invalid toggle passed in: toggle2", p["error"])
		})

		t.Run("because it is configured to be read-only", func(t *testing.T) {
			updates := []featuremgmt.FeatureToggleDTO{
				{
					Name:    "toggle3",
					Enabled: true,
				},
			}
			res := runSetScenario(t, features, updates, s, writePermissions, http.StatusBadRequest)
			defer func() { require.NoError(t, res.Body.Close()) }()
			p := readBody(t, res.Body)
			assert.Equal(t, "invalid toggle passed in: toggle3", p["error"])
		})
	})

	t.Run("when all conditions met", func(t *testing.T) {
		features := []*featuremgmt.FeatureFlag{
			{
				Name:    featuremgmt.FlagFeatureToggleAdminPage,
				Enabled: true,
				Stage:   featuremgmt.FeatureStageGeneralAvailability,
			}, {
				Name:    "toggle2",
				Enabled: false,
				Stage:   featuremgmt.FeatureStagePublicPreview,
			}, {
				Name:    "toggle3",
				Enabled: false,
				Stage:   featuremgmt.FeatureStageGeneralAvailability,
			}, {
				Name:    "toggle4",
				Enabled: false,
				Stage:   featuremgmt.FeatureStageGeneralAvailability,
			}, {
				Name:    "toggle5",
				Enabled: false,
				Stage:   featuremgmt.FeatureStageDeprecated,
			},
		}

		s := setting.FeatureMgmtSettings{
			AllowEditing:       true,
			UpdateWebhook:      "random",
			UpdateWebhookToken: "token",
			ReadOnlyToggles: map[string]struct{}{
				"toggle3": {},
			},
		}

		updates := []featuremgmt.FeatureToggleDTO{
			{
				Name:    "toggle4",
				Enabled: true,
			}, {
				Name:    "toggle5",
				Enabled: false,
			},
		}
		t.Run("fail when webhook request is not successful", func(t *testing.T) {
			webhookServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusBadRequest)
			}))
			defer webhookServer.Close()
			s.UpdateWebhook = webhookServer.URL
			res := runSetScenario(t, features, updates, s, writePermissions, http.StatusBadRequest)
			defer func() { require.NoError(t, res.Body.Close()) }()
			assert.Equal(t, http.StatusBadRequest, res.StatusCode)
		})

		t.Run("succeed when webhook request is successul", func(t *testing.T) {
			webhookServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "Bearer "+s.UpdateWebhookToken, r.Header.Get("Authorization"))

				var req UpdatePayload
				require.NoError(t, json.NewDecoder(r.Body).Decode(&req))

				assert.Equal(t, "true", req.FeatureToggles["toggle4"])
				assert.Equal(t, "false", req.FeatureToggles["toggle5"])
				w.WriteHeader(http.StatusOK)
			}))
			defer webhookServer.Close()
			s.UpdateWebhook = webhookServer.URL
			res := runSetScenario(t, features, updates, s, writePermissions, http.StatusOK)
			defer func() { require.NoError(t, res.Body.Close()) }()
			assert.Equal(t, http.StatusOK, res.StatusCode)
		})
	})
}

func findResult(t *testing.T, result []featuremgmt.FeatureToggleDTO, name string) (featuremgmt.FeatureToggleDTO, bool) {
	t.Helper()

	for _, t := range result {
		if t.Name == name {
			return t, true
		}
	}
	return featuremgmt.FeatureToggleDTO{}, false
}

func readBody(t *testing.T, rc io.ReadCloser) map[string]any {
	t.Helper()

	b, err := io.ReadAll(rc)
	require.NoError(t, err)
	payload := map[string]any{}
	require.NoError(t, json.Unmarshal(b, &payload))
	return payload
}

func runGetScenario(
	t *testing.T,
	features []*featuremgmt.FeatureFlag,
	settings setting.FeatureMgmtSettings,
	permissions []accesscontrol.Permission,
	expectedCode int,
) []featuremgmt.FeatureToggleDTO {
	// Set up server and send request
	cfg := setting.NewCfg()
	cfg.FeatureManagement = settings

	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = cfg
		hs.Features = featuremgmt.WithFeatureFlags(append([]*featuremgmt.FeatureFlag{{
			Name:    featuremgmt.FlagFeatureToggleAdminPage,
			Enabled: true,
			Stage:   featuremgmt.FeatureStageGeneralAvailability,
		}}, features...))
		hs.orgService = orgtest.NewOrgServiceFake()
		hs.userService = &usertest.FakeUserService{
			ExpectedUser: &user.User{ID: 1},
		}
		hs.log = log.New("test")
	})
	req := webtest.RequestWithSignedInUser(server.NewGetRequest("/api/featuremgmt"), userWithPermissions(1, permissions))
	res, err := server.SendJSON(req)
	defer func() { require.NoError(t, res.Body.Close()) }()

	// Do some general checks for every request
	require.NoError(t, err)
	require.Equal(t, expectedCode, res.StatusCode)
	if res.StatusCode >= 400 {
		return nil
	}

	var result []featuremgmt.FeatureToggleDTO
	err = json.NewDecoder(res.Body).Decode(&result)
	require.NoError(t, err)

	for i := 0; i < len(result); {
		ft := result[i]
		// Always make sure admin page toggle is read-only, then remove it to make assertions easier
		if ft.Name == featuremgmt.FlagFeatureToggleAdminPage {
			assert.True(t, ft.ReadOnly)
			result = append(result[:i], result[i+1:]...)
			continue
		}

		// Make sure toggles explicitly marked "hidden" by config are hidden
		if _, ok := cfg.FeatureManagement.HiddenToggles[ft.Name]; ok {
			t.Fail()
		}

		// Make sure toggles explicitly marked "read only" by config are read only
		if _, ok := cfg.FeatureManagement.ReadOnlyToggles[ft.Name]; ok {
			assert.True(t, ft.ReadOnly)
		}
		i++
	}

	return result
}

func runSetScenario(
	t *testing.T,
	serverFeatures []*featuremgmt.FeatureFlag,
	updateFeatures []featuremgmt.FeatureToggleDTO,
	settings setting.FeatureMgmtSettings,
	permissions []accesscontrol.Permission,
	expectedCode int,
) *http.Response {
	// Set up server and send request
	cfg := setting.NewCfg()
	cfg.FeatureManagement = settings

	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = cfg
		hs.Features = featuremgmt.WithFeatureFlags(append([]*featuremgmt.FeatureFlag{{
			Name:    featuremgmt.FlagFeatureToggleAdminPage,
			Enabled: true,
			Stage:   featuremgmt.FeatureStageGeneralAvailability,
		}}, serverFeatures...))
		hs.orgService = orgtest.NewOrgServiceFake()
		hs.userService = &usertest.FakeUserService{
			ExpectedUser: &user.User{ID: 1},
		}
		hs.log = log.New("test")
	})

	cmd := featuremgmt.UpdateFeatureTogglesCommand{
		FeatureToggles: updateFeatures,
	}
	b, err := json.Marshal(cmd)
	require.NoError(t, err)
	req := webtest.RequestWithSignedInUser(server.NewPostRequest("/api/featuremgmt", bytes.NewReader(b)), userWithPermissions(1, permissions))
	res, err := server.SendJSON(req)

	require.NoError(t, err)
	require.NotNil(t, res)
	require.Equal(t, expectedCode, res.StatusCode)

	return res
}
