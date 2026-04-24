package preferences

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationPreferences(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
		},
	})

	t.Run("legacy preferences api", func(t *testing.T) {
		ctx := context.Background()
		clientAdmin := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  preferences.PreferencesResourceInfo.GroupVersionResource(),
		})
		clientViewer := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Viewer,
			GVR:  preferences.PreferencesResourceInfo.GroupVersionResource(),
		})

		// List is empty when we start
		rsp, err := clientAdmin.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.Empty(t, rsp.Items, "no preferences saved yet")

		raw := make(map[string]any)
		legacyResponse := apis.DoRequest(helper, apis.RequestParams{
			User:   clientAdmin.Args.User,
			Method: http.MethodPut,
			Path:   "/api/user/preferences",
			Body: []byte(`{
				"weekStart": "saturday"
			}`),
		}, &raw)
		require.Equal(t, http.StatusOK, legacyResponse.Response.StatusCode, "create preference for user")

		// http://localhost:3000/api/teams/1/preferences
		legacyResponse = apis.DoRequest(helper, apis.RequestParams{
			User:   clientAdmin.Args.User,
			Method: http.MethodPut,
			Path:   fmt.Sprintf("/api/teams/%d/preferences", helper.Org1.Staff.ID),
			Body: []byte(`{
				"weekStart": "sunday",
				"timezone": "Africa/Johannesburg"
			}`),
		}, &raw)
		require.Equal(t, http.StatusOK, legacyResponse.Response.StatusCode, "create preference for user")

		// http://localhost:3000/api/org/preferences
		legacyResponse = apis.DoRequest(helper, apis.RequestParams{
			User:   clientAdmin.Args.User,
			Method: http.MethodPut,
			Path:   "/api/org/preferences",
			Body: []byte(`{
				"weekStart": "sunday",
				"timezone": "Africa/Accra",
				"theme": "dark"
			}`),
		}, &raw)
		require.Equal(t, http.StatusOK, legacyResponse.Response.StatusCode, "create preference for user")

		adminPrefsName := "user-" + clientAdmin.Args.User.Identity.GetIdentifier()

		// Admin has access to all three (namespace, team, and user)
		rsp, err = clientAdmin.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		names := make([]string, 0, len(rsp.Items))
		for _, item := range rsp.Items {
			names = append(names, item.GetName())
		}
		require.Equal(t, []string{
			"namespace",
			fmt.Sprintf("team-%s", helper.Org1.Staff.UID),
			adminPrefsName,
		}, names)

		obj, err := clientAdmin.Resource.Get(ctx, adminPrefsName, metav1.GetOptions{})
		require.NoError(t, err)
		jj, err := json.MarshalIndent(obj.Object["spec"], "", "  ")
		require.NoError(t, err)
		require.JSONEq(t, `{
			"weekStart":"saturday"
		}`, string(jj))
		obj.Object["spec"] = map[string]any{
			"weekStart":      "saturday",
			"regionalFormat": "dd/mm/yyyy",
		}

		// Set the regional format via k8s API
		obj, err = clientAdmin.Resource.Update(ctx, obj, metav1.UpdateOptions{})
		require.NoError(t, err)
		jj, err = json.MarshalIndent(obj.Object["spec"], "", "  ")
		require.NoError(t, err)
		require.JSONEq(t, `{
			"weekStart":      "saturday",
			"regionalFormat": "dd/mm/yyyy"
		}`, string(jj))

		// The viewer should only have namespace (eg org level) permissions
		rsp, err = clientViewer.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		names = make([]string, 0, len(rsp.Items))
		for _, item := range rsp.Items {
			names = append(names, item.GetName())
		}
		require.Equal(t, []string{"namespace"}, names)

		// Pull the preferences out of bootdata (many other things are included!)
		type shim struct {
			User preferences.PreferencesSpec `json:"user"` // pretend
		}
		bootdata := apis.DoRequest(helper, apis.RequestParams{
			User:   clientAdmin.Args.User,
			Method: http.MethodGet,
			Path:   "/bootdata",
		}, &shim{})
		require.Equal(t, http.StatusOK, bootdata.Response.StatusCode, "get bootdata preferences")

		jj, _ = json.Marshal(bootdata.Result.User)
		require.JSONEq(t, `{
			"timezone":"Africa/Johannesburg",
			"weekStart":"saturday",
			"theme":"dark",
			"language":"en-US", `+ // FROM global default!
			`"regionalFormat": ""}`, // why empty?
			string(jj))

		merged := apis.DoRequest(helper, apis.RequestParams{
			User:   clientAdmin.Args.User,
			Method: http.MethodGet,
			Path:   "/apis/preferences.grafana.app/v1alpha1/namespaces/default/preferences/merged",
		}, &preferences.Preferences{})
		require.Equal(t, http.StatusOK, merged.Response.StatusCode, "get merged preferences")
		require.Equal(t, "saturday", *merged.Result.Spec.WeekStart)           // from user
		require.Equal(t, "Africa/Johannesburg", *merged.Result.Spec.Timezone) // from team
		require.Equal(t, "dark", *merged.Result.Spec.Theme)                   // from org
		require.Equal(t, "en-US", *merged.Result.Spec.Language)               // settings.ini
		require.Equal(t, "dd/mm/yyyy", *merged.Result.Spec.RegionalFormat)    // from user update
	})
}
