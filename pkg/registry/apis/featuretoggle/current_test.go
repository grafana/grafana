package featuretoggle

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apis/featuretoggle/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetFeatureToggles(t *testing.T) {
	t.Run("fails without adequate permissions", func(t *testing.T) {
		features := featuremgmt.WithFeatureManager(setting.FeatureMgmtSettings{}, []*featuremgmt.FeatureFlag{{
			// Add this here to ensure the feature works as expected during tests
			Name:  featuremgmt.FlagFeatureToggleAdminPage,
			Stage: featuremgmt.FeatureStageGeneralAvailability,
		}})

		b := NewFeatureFlagAPIBuilder(features, actest.FakeAccessControl{ExpectedEvaluate: false}, &setting.Cfg{})

		callGetWith(t, b, http.StatusUnauthorized)
	})

	t.Run("should be able to get feature toggles", func(t *testing.T) {
		features := []*featuremgmt.FeatureFlag{
			{
				Name:  "toggle1",
				Stage: featuremgmt.FeatureStageGeneralAvailability,
			}, {
				Name:  "toggle2",
				Stage: featuremgmt.FeatureStageGeneralAvailability,
			},
		}
		disabled := []string{"toggle2"}

		b := newTestAPIBuilder(t, features, disabled, setting.FeatureMgmtSettings{})
		result := callGetWith(t, b, http.StatusOK)
		assert.Len(t, result.Toggles, 2)
		t1, _ := findResult(t, result, "toggle1")
		assert.True(t, t1.Enabled)
		t2, _ := findResult(t, result, "toggle2")
		assert.False(t, t2.Enabled)
	})

	t.Run("toggles hidden by config are not present in the response", func(t *testing.T) {
		features := []*featuremgmt.FeatureFlag{
			{
				Name:  "toggle1",
				Stage: featuremgmt.FeatureStageGeneralAvailability,
			}, {
				Name:  "toggle2",
				Stage: featuremgmt.FeatureStageGeneralAvailability,
			},
		}
		settings := setting.FeatureMgmtSettings{
			HiddenToggles: map[string]struct{}{"toggle1": {}},
		}

		b := newTestAPIBuilder(t, features, []string{}, settings)
		result := callGetWith(t, b, http.StatusOK)

		assert.Len(t, result.Toggles, 1)
		assert.Equal(t, "toggle2", result.Toggles[0].Name)
	})

	t.Run("toggles that are read-only by config have the readOnly field set", func(t *testing.T) {
		features := []*featuremgmt.FeatureFlag{
			{
				Name:  "toggle1",
				Stage: featuremgmt.FeatureStageGeneralAvailability,
			}, {
				Name:  "toggle2",
				Stage: featuremgmt.FeatureStageGeneralAvailability,
			},
		}
		disabled := []string{"toggle2"}
		settings := setting.FeatureMgmtSettings{
			HiddenToggles:   map[string]struct{}{"toggle1": {}},
			ReadOnlyToggles: map[string]struct{}{"toggle2": {}},
			AllowEditing:    true,
			UpdateWebhook:   "bogus",
		}

		b := newTestAPIBuilder(t, features, disabled, settings)
		result := callGetWith(t, b, http.StatusOK)

		assert.Len(t, result.Toggles, 1)
		assert.Equal(t, "toggle2", result.Toggles[0].Name)
		assert.False(t, result.Toggles[0].Writeable)
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
				Name:           "toggle4",
				Stage:          featuremgmt.FeatureStagePublicPreview,
				AllowSelfServe: true,
			}, {
				Name:           "toggle5",
				Stage:          featuremgmt.FeatureStageGeneralAvailability,
				AllowSelfServe: true,
			}, {
				Name:           "toggle6",
				Stage:          featuremgmt.FeatureStageDeprecated,
				AllowSelfServe: true,
			}, {
				Name:           "toggle7",
				Stage:          featuremgmt.FeatureStageGeneralAvailability,
				AllowSelfServe: false,
			},
		}

		t.Run("unknown, experimental, and private preview toggles are hidden by default", func(t *testing.T) {
			b := newTestAPIBuilder(t, features, []string{}, setting.FeatureMgmtSettings{})
			result := callGetWith(t, b, http.StatusOK)

			assert.Len(t, result.Toggles, 4)

			_, ok := findResult(t, result, "toggle1")
			assert.False(t, ok)
			_, ok = findResult(t, result, "toggle2")
			assert.False(t, ok)
			_, ok = findResult(t, result, "toggle3")
			assert.False(t, ok)
		})

		t.Run("only public preview and GA with AllowSelfServe are writeable", func(t *testing.T) {
			settings := setting.FeatureMgmtSettings{
				AllowEditing:  true,
				UpdateWebhook: "bogus",
			}

			b := newTestAPIBuilder(t, features, []string{}, settings)
			result := callGetWith(t, b, http.StatusOK)

			t4, ok := findResult(t, result, "toggle4")
			assert.True(t, ok)
			assert.True(t, t4.Writeable)
			t5, ok := findResult(t, result, "toggle5")
			assert.True(t, ok)
			assert.True(t, t5.Writeable)
			t6, ok := findResult(t, result, "toggle6")
			assert.True(t, ok)
			assert.True(t, t6.Writeable)
		})

		t.Run("all toggles are read-only when server is misconfigured", func(t *testing.T) {
			settings := setting.FeatureMgmtSettings{
				AllowEditing:  false,
				UpdateWebhook: "",
			}
			b := newTestAPIBuilder(t, features, []string{}, settings)
			result := callGetWith(t, b, http.StatusOK)

			assert.Len(t, result.Toggles, 4)

			t4, ok := findResult(t, result, "toggle4")
			assert.True(t, ok)
			assert.False(t, t4.Writeable)
			t5, ok := findResult(t, result, "toggle5")
			assert.True(t, ok)
			assert.False(t, t5.Writeable)
			t6, ok := findResult(t, result, "toggle6")
			assert.True(t, ok)
			assert.False(t, t6.Writeable)
		})
	})
}

func TestSetFeatureToggles(t *testing.T) {
	t.Run("fails when the user doesn't have write permissions", func(t *testing.T) {
		s := setting.FeatureMgmtSettings{
			AllowEditing:  true,
			UpdateWebhook: "random",
		}
		features := featuremgmt.WithFeatureManager(s, []*featuremgmt.FeatureFlag{{
			// Add this here to ensure the feature works as expected during tests
			Name:  featuremgmt.FlagFeatureToggleAdminPage,
			Stage: featuremgmt.FeatureStageGeneralAvailability,
		}})

		b := NewFeatureFlagAPIBuilder(features, actest.FakeAccessControl{ExpectedEvaluate: false}, &setting.Cfg{})
		msg := callPatchWith(t, b, v0alpha1.ResolvedToggleState{}, http.StatusUnauthorized)
		assert.Equal(t, "missing write permission", msg)
	})

	t.Run("fails when update toggle url is not set", func(t *testing.T) {
		s := setting.FeatureMgmtSettings{
			AllowEditing: true,
		}
		b := newTestAPIBuilder(t, nil, []string{}, s)
		msg := callPatchWith(t, b, v0alpha1.ResolvedToggleState{}, http.StatusForbidden)
		assert.Equal(t, "feature toggles are read-only", msg)
	})

	t.Run("fails with non-existent toggle", func(t *testing.T) {
		features := []*featuremgmt.FeatureFlag{
			{
				Name:  "toggle1",
				Stage: featuremgmt.FeatureStageGeneralAvailability,
			}, {
				Name:  "toggle2",
				Stage: featuremgmt.FeatureStageGeneralAvailability,
			},
		}
		disabled := []string{"toggle2"}
		update := v0alpha1.ResolvedToggleState{
			Enabled: map[string]bool{
				"toggle3": true,
			},
		}

		s := setting.FeatureMgmtSettings{
			AllowEditing:  true,
			UpdateWebhook: "random",
		}
		b := newTestAPIBuilder(t, features, disabled, s)
		msg := callPatchWith(t, b, update, http.StatusBadRequest)
		assert.Equal(t, "invalid toggle passed in", msg)
	})

	t.Run("fails with read-only toggles", func(t *testing.T) {
		features := []*featuremgmt.FeatureFlag{
			{
				Name:  featuremgmt.FlagFeatureToggleAdminPage,
				Stage: featuremgmt.FeatureStageGeneralAvailability,
			}, {
				Name:  "toggle2",
				Stage: featuremgmt.FeatureStagePublicPreview,
			}, {
				Name:  "toggle3",
				Stage: featuremgmt.FeatureStageGeneralAvailability,
			},
		}
		disabled := []string{"toggle2", "toggle3"}

		s := setting.FeatureMgmtSettings{
			AllowEditing:  true,
			UpdateWebhook: "random",
			ReadOnlyToggles: map[string]struct{}{
				"toggle3": {},
			},
		}

		t.Run("because it is the feature toggle admin page toggle", func(t *testing.T) {
			update := v0alpha1.ResolvedToggleState{
				Enabled: map[string]bool{
					featuremgmt.FlagFeatureToggleAdminPage: true,
				},
			}
			b := newTestAPIBuilder(t, features, disabled, s)
			callPatchWith(t, b, update, http.StatusNotModified)
		})

		t.Run("because it is not GA or Deprecated", func(t *testing.T) {
			update := v0alpha1.ResolvedToggleState{
				Enabled: map[string]bool{
					"toggle2": true,
				},
			}
			b := newTestAPIBuilder(t, features, disabled, s)
			msg := callPatchWith(t, b, update, http.StatusBadRequest)
			assert.Equal(t, "invalid toggle passed in", msg)
		})

		t.Run("because it is configured to be read-only", func(t *testing.T) {
			update := v0alpha1.ResolvedToggleState{
				Enabled: map[string]bool{
					"toggle2": true,
				},
			}
			b := newTestAPIBuilder(t, features, disabled, s)
			msg := callPatchWith(t, b, update, http.StatusBadRequest)
			assert.Equal(t, "invalid toggle passed in", msg)
		})
	})

	t.Run("when all conditions met", func(t *testing.T) {
		features := []*featuremgmt.FeatureFlag{
			{
				Name:  featuremgmt.FlagFeatureToggleAdminPage,
				Stage: featuremgmt.FeatureStageGeneralAvailability,
			}, {
				Name:  "toggle2",
				Stage: featuremgmt.FeatureStagePublicPreview,
			}, {
				Name:  "toggle3",
				Stage: featuremgmt.FeatureStageGeneralAvailability,
			}, {
				Name:           "toggle4",
				Stage:          featuremgmt.FeatureStageGeneralAvailability,
				AllowSelfServe: true,
			}, {
				Name:           "toggle5",
				Stage:          featuremgmt.FeatureStageDeprecated,
				AllowSelfServe: true,
			},
		}
		disabled := []string{"toggle2", "toggle3", "toggle4"}

		s := setting.FeatureMgmtSettings{
			AllowEditing:       true,
			UpdateWebhook:      "random",
			UpdateWebhookToken: "token",
			ReadOnlyToggles: map[string]struct{}{
				"toggle3": {},
			},
		}

		update := v0alpha1.ResolvedToggleState{
			Enabled: map[string]bool{
				"toggle4": true,
				"toggle5": false,
			},
		}
		t.Run("fail when webhook request is not successful", func(t *testing.T) {
			webhookServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusBadRequest)
			}))
			defer webhookServer.Close()
			s.UpdateWebhook = webhookServer.URL

			b := newTestAPIBuilder(t, features, disabled, s)
			msg := callPatchWith(t, b, update, http.StatusInternalServerError)
			assert.Equal(t, "an error occurred while updating feeature toggles", msg)
		})

		t.Run("succeed when webhook request is not successful but app is in dev mode", func(t *testing.T) {
			webhookServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusBadRequest)
			}))
			defer webhookServer.Close()
			s.UpdateWebhook = webhookServer.URL

			b := newTestAPIBuilder(t, features, disabled, s)
			b.cfg.Env = setting.Dev
			callPatchWith(t, b, update, http.StatusOK)
		})

		t.Run("succeed when webhook request is successful", func(t *testing.T) {
			webhookServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "Bearer "+s.UpdateWebhookToken, r.Header.Get("Authorization"))

				var req featuremgmt.FeatureToggleWebhookPayload
				require.NoError(t, json.NewDecoder(r.Body).Decode(&req))

				assert.Equal(t, "true", req.FeatureToggles["toggle4"])
				assert.Equal(t, "false", req.FeatureToggles["toggle5"])
				w.WriteHeader(http.StatusOK)
			}))
			defer webhookServer.Close()
			s.UpdateWebhook = webhookServer.URL

			b := newTestAPIBuilder(t, features, disabled, s)
			msg := callPatchWith(t, b, update, http.StatusOK)
			assert.Equal(t, "feature toggles updated successfully", msg)
		})
	})
}

func findResult(t *testing.T, result v0alpha1.ResolvedToggleState, name string) (v0alpha1.ToggleStatus, bool) {
	t.Helper()

	for _, t := range result.Toggles {
		if t.Name == name {
			return t, true
		}
	}
	return v0alpha1.ToggleStatus{}, false
}

func callGetWith(t *testing.T, b *FeatureFlagAPIBuilder, expectedCode int) v0alpha1.ResolvedToggleState {
	w := response.CreateNormalResponse(http.Header{}, []byte{}, 0)
	req := &http.Request{
		Method: "GET",
		Header: http.Header{},
	}
	req.Header.Add("content-type", "application/json")
	req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{}))
	b.handleCurrentStatus(w, req)

	rts := v0alpha1.ResolvedToggleState{}
	require.NoError(t, json.Unmarshal(w.Body(), &rts))
	require.Equal(t, expectedCode, w.Status())

	// Tests don't expect the feature toggle admin page feature to be present, so remove them from the resolved toggle state
	for i, t := range rts.Toggles {
		if t.Name == "featureToggleAdminPage" {
			rts.Toggles = append(rts.Toggles[0:i], rts.Toggles[i+1:]...)
		}
	}

	return rts
}

func callPatchWith(t *testing.T, b *FeatureFlagAPIBuilder, update v0alpha1.ResolvedToggleState, expectedCode int) string {
	w := response.CreateNormalResponse(http.Header{}, []byte{}, 0)

	body, err := json.Marshal(update)
	require.NoError(t, err)

	req := &http.Request{
		Method: "PATCH",
		Body:   io.NopCloser(bytes.NewReader(body)),
		Header: http.Header{},
	}
	req.Header.Add("content-type", "application/json")
	req = req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{}))
	b.handleCurrentStatus(w, req)

	require.NotNil(t, w.Body())
	require.Equal(t, expectedCode, w.Status())

	// Extract the public facing message if this is an error
	if w.Status() > 399 {
		res := map[string]any{}
		require.NoError(t, json.Unmarshal(w.Body(), &res))

		return res["message"].(string)
	}

	return string(w.Body())
}

func newTestAPIBuilder(
	t *testing.T,
	serverFeatures []*featuremgmt.FeatureFlag,
	disabled []string, // the flags that are disabled
	settings setting.FeatureMgmtSettings,
) *FeatureFlagAPIBuilder {
	t.Helper()
	features := featuremgmt.WithFeatureManager(settings, append([]*featuremgmt.FeatureFlag{{
		// Add this here to ensure the feature works as expected during tests
		Name:  featuremgmt.FlagFeatureToggleAdminPage,
		Stage: featuremgmt.FeatureStageGeneralAvailability,
	}}, serverFeatures...), disabled...)

	return NewFeatureFlagAPIBuilder(features, actest.FakeAccessControl{ExpectedEvaluate: true}, &setting.Cfg{})
}
