package api

import (
	"encoding/json"
	"net/http"
	"testing"

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

	find := func(result []featuremgmt.FeatureToggleDTO, name string) (featuremgmt.FeatureToggleDTO, bool) {
		for _, t := range result {
			if t.Name == name {
				return t, true
			}
		}
		return featuremgmt.FeatureToggleDTO{}, false
	}

	t.Run("should not be able to get feature toggles without permissions", func(t *testing.T) {
		result := runTestScenario(t, []*featuremgmt.FeatureFlag{}, nil, nil, []accesscontrol.Permission{}, http.StatusForbidden)
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

		result := runTestScenario(t, features, nil, nil, readPermissions, http.StatusOK)
		assert.Len(t, result, 2)
		t1, _ := find(result, "toggle1")
		assert.True(t, t1.Enabled)
		t2, _ := find(result, "toggle2")
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

		result := runTestScenario(t, features, map[string]struct{}{"toggle1": {}}, nil, readPermissions, http.StatusOK)
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

		result := runTestScenario(t, features, map[string]struct{}{"toggle1": {}}, map[string]struct{}{"toggle2": {}}, readPermissions, http.StatusOK)
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
			result := runTestScenario(t, features, nil, nil, readPermissions, http.StatusOK)
			assert.Len(t, result, 3)

			_, ok := find(result, "toggle1")
			assert.False(t, ok)
			_, ok = find(result, "toggle2")
			assert.False(t, ok)
			_, ok = find(result, "toggle3")
			assert.False(t, ok)
		})

		t.Run("only public preview and GA are writeable by default", func(t *testing.T) {
			result := runTestScenario(t, features, nil, nil, readPermissions, http.StatusOK)
			assert.Len(t, result, 3)

			t4, ok := find(result, "toggle4")
			assert.True(t, ok)
			assert.True(t, t4.ReadOnly)
			t5, ok := find(result, "toggle5")
			assert.True(t, ok)
			assert.False(t, t5.ReadOnly)
			t6, ok := find(result, "toggle6")
			assert.True(t, ok)
			assert.False(t, t6.ReadOnly)
		})
	})
}

func runTestScenario(
	t *testing.T,
	features []*featuremgmt.FeatureFlag,
	hiddenToggles map[string]struct{},
	readOnlyToggles map[string]struct{},
	permissions []accesscontrol.Permission,
	expectedCode int,
) []featuremgmt.FeatureToggleDTO {
	// Set up server and send request
	cfg := setting.NewCfg()
	cfg.FeatureManagement.HiddenToggles = hiddenToggles
	cfg.FeatureManagement.ReadOnlyToggles = readOnlyToggles

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
		if _, ok := hiddenToggles[ft.Name]; ok {
			t.Fail()
		}

		// Make sure toggles explicitly marked "read only" by config are read only
		if _, ok := readOnlyToggles[ft.Name]; ok {
			assert.True(t, ft.ReadOnly)
		}
		i++
	}

	return result
}
