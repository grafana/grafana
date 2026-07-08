package api

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	featuretoggleapi "github.com/grafana/grafana/pkg/services/featuremgmt/feature_toggle_api"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestAPI_AdminGetFeatureToggles(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Features = featuremgmt.WithFeatures("lokiQuerySplitting", "unknownFlag")
	})

	res, err := server.Send(webtest.RequestWithSignedInUser(
		server.NewGetRequest("/api/admin/feature-toggles"),
		userWithPermissions(1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionFeatureManagementRead},
			{Action: accesscontrol.ActionFeatureManagementWrite},
		}),
	))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, res.StatusCode)
	defer func() { require.NoError(t, res.Body.Close()) }()

	var body featuretoggleapi.ResolvedToggleState
	require.NoError(t, json.NewDecoder(res.Body).Decode(&body))

	require.True(t, body.AllowEditing)
	require.True(t, body.Enabled["lokiQuerySplitting"])

	lokiQuerySplitting := findToggleStatus(t, body.Toggles, "lokiQuerySplitting")
	require.True(t, lokiQuerySplitting.Enabled)
	require.Equal(t, "GA", lokiQuerySplitting.Stage)
	require.True(t, lokiQuerySplitting.FrontendOnly)
	require.False(t, lokiQuerySplitting.Writeable)

	unknownFlag := findToggleStatus(t, body.Toggles, "unknownFlag")
	require.True(t, unknownFlag.Enabled)
	require.Equal(t, "unknown", unknownFlag.Stage)
	require.Equal(t, "Configured feature toggle is not registered in this build.", unknownFlag.Warning)
}

func TestAPI_AdminGetFeatureTogglesAccessControl(t *testing.T) {
	server := SetupAPITestServer(t)

	res, err := server.Send(webtest.RequestWithSignedInUser(
		server.NewGetRequest("/api/admin/feature-toggles"),
		userWithPermissions(1, []accesscontrol.Permission{{Action: "wrong"}}),
	))
	require.NoError(t, err)
	require.Equal(t, http.StatusForbidden, res.StatusCode)
	require.NoError(t, res.Body.Close())
}

func findToggleStatus(t *testing.T, toggles []featuretoggleapi.ToggleStatus, name string) featuretoggleapi.ToggleStatus {
	t.Helper()

	for _, toggle := range toggles {
		if toggle.Name == name {
			return toggle
		}
	}

	require.Failf(t, "toggle not found", "expected to find toggle %q", name)
	return featuretoggleapi.ToggleStatus{}
}
