package identity

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

type userTeamsResponse struct {
	Items []struct {
		TeamRef struct {
			Name string `json:"name"`
		} `json:"teamRef"`
		Permission string `json:"permission"`
		External   bool   `json:"external"`
	} `json:"items"`
}

func TestIntegrationUserTeams(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}

	for _, mode := range modes {
		func() {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    false,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"users.iam.grafana.app": {
						DualWriterMode: mode,
					},
					"teams.iam.grafana.app": {
						DualWriterMode: mode,
					},
					"teambindings.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesAuthnMutation,
				},
				UnifiedStorageEnableSearch: true,
			})

			defer helper.Shutdown()

			t.Run(fmt.Sprintf("user teams endpoint with dual writer mode %d", mode), func(t *testing.T) {
				doUserTeamsTests(t, helper)
			})
		}()
	}
}

func doUserTeamsTests(t *testing.T, helper *apis.K8sTestHelper) {
	ctx := context.Background()
	orgNS := helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID())

	userClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: orgNS,
		GVR:       gvrUsers,
	})

	teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: orgNS,
		GVR:       gvrTeams,
	})

	tbClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: orgNS,
		GVR:       gvrTeamBindings,
	})

	// Create u1 - will be bound to all 5 teams
	u1, err := userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("testdata/user-test-create-v0.yaml"), metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, u1)

	// Create u2 - no bindings
	u2Obj := helper.LoadYAMLOrJSONFile("testdata/user-test-create-v0.yaml")
	u2Obj.Object["metadata"].(map[string]any)["name"] = "user-no-binding"
	u2Obj.Object["spec"].(map[string]any)["login"] = "user-no-binding"
	u2Obj.Object["spec"].(map[string]any)["email"] = "user-no-binding@example.com"

	u2, err := userClient.Resource.Create(ctx, u2Obj, metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, u2)

	// Create 5 teams
	teams := make([]*unstructured.Unstructured, 0, 5)
	for i := 1; i <= 5; i++ {
		teamObj := createTeamObject(helper,
			fmt.Sprintf("team-%d", i),
			fmt.Sprintf("Team %d", i),
			fmt.Sprintf("team-%d@example.com", i),
		)
		team, err := teamClient.Resource.Create(ctx, teamObj, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, team)
		teams = append(teams, team)
	}

	// Create team bindings: u1 -> all 5 teams
	for _, team := range teams {
		tbObj := createTeamBindingObject(helper, u1.GetName(), team.GetName())
		_, err := tbClient.Resource.Create(ctx, tbObj, metav1.CreateOptions{})
		require.NoError(t, err)
	}

	t.Run("returns the bound team for the user", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/default/users/%s/teams", u1.GetName())

		var res userTeamsResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &res)

		require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
		require.True(t, containsTeam(res, teams[0].GetName()), "expected response to contain team %q, got %#v", teams[0].GetName(), res.Items)

		item := findTeam(res, teams[0].GetName())
		require.Equal(t, "admin", item.Permission)
		require.False(t, item.External)
	})

	t.Run("does not return the bound team for a different user", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/default/users/%s/teams", u2.GetName())

		var res userTeamsResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &res)

		require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
		require.False(t, containsTeam(res, teams[0].GetName()), "did not expect response to contain team %q, got %#v", teams[0].GetName(), res.Items)
	})

	t.Run("paging with page and limit", func(t *testing.T) {
		// Page 1, Limit 2
		res1 := getUserTeamsWithPaging(t, helper, u1.GetName(), 1, 2)
		require.Len(t, res1.Items, 2)

		// Page 2, Limit 2
		res2 := getUserTeamsWithPaging(t, helper, u1.GetName(), 2, 2)
		require.Len(t, res2.Items, 2)

		// Page 3, Limit 2
		res3 := getUserTeamsWithPaging(t, helper, u1.GetName(), 3, 2)
		require.Len(t, res3.Items, 1)

		seen := make(map[string]bool)
		for _, item := range res1.Items {
			teamName := item.TeamRef.Name
			require.False(t, seen[teamName], "Team %s seen in page 1 twice", teamName)
			seen[teamName] = true
		}
		for _, item := range res2.Items {
			teamName := item.TeamRef.Name
			require.False(t, seen[teamName], "Team %s seen in page 1 and 2", teamName)
			seen[teamName] = true
		}
		for _, item := range res3.Items {
			teamName := item.TeamRef.Name
			require.False(t, seen[teamName], "Team %s seen in previous pages", teamName)
			seen[teamName] = true
		}
		require.Len(t, seen, 5, "Should have seen all 5 teams across pages")
	})

	t.Run("paging with offset and limit", func(t *testing.T) {
		// Offset 0, Limit 2
		res1 := getUserTeamsWithOffset(t, helper, u1.GetName(), 0, 2)
		require.Len(t, res1.Items, 2)

		// Offset 2, Limit 2
		res2 := getUserTeamsWithOffset(t, helper, u1.GetName(), 2, 2)
		require.Len(t, res2.Items, 2)

		// Offset 4, Limit 2
		res3 := getUserTeamsWithOffset(t, helper, u1.GetName(), 4, 2)
		require.Len(t, res3.Items, 1)

		seen := make(map[string]bool)
		for _, item := range res1.Items {
			teamName := item.TeamRef.Name
			require.False(t, seen[teamName], "Team %s seen in offset 0 twice", teamName)
			seen[teamName] = true
		}
		for _, item := range res2.Items {
			teamName := item.TeamRef.Name
			require.False(t, seen[teamName], "Team %s seen in offset 0 and 2", teamName)
			seen[teamName] = true
		}
		for _, item := range res3.Items {
			teamName := item.TeamRef.Name
			require.False(t, seen[teamName], "Team %s seen in previous offsets", teamName)
			seen[teamName] = true
		}
		require.Len(t, seen, 5, "Should have seen all 5 teams across offsets")
	})
}

func createTeamObject(helper *apis.K8sTestHelper, teamName string, title string, email string) *unstructured.Unstructured {
	teamObj := helper.LoadYAMLOrJSONFile("testdata/team-test-create-v0.yaml")
	teamObj.Object["metadata"].(map[string]any)["name"] = teamName
	teamObj.Object["spec"].(map[string]any)["title"] = title
	teamObj.Object["spec"].(map[string]any)["email"] = email

	return teamObj
}

func containsTeam(res userTeamsResponse, teamName string) bool {
	for _, it := range res.Items {
		if it.TeamRef.Name == teamName {
			return true
		}
	}
	return false
}

func findTeam(res userTeamsResponse, teamName string) (out struct {
	TeamRef struct {
		Name string `json:"name"`
	} `json:"teamRef"`
	Permission string `json:"permission"`
	External   bool   `json:"external"`
}) {
	for _, it := range res.Items {
		if it.TeamRef.Name == teamName {
			return it
		}
	}
	return out
}

func getUserTeamsWithPaging(t *testing.T, helper *apis.K8sTestHelper, userName string, page, limit int) userTeamsResponse {
	path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/default/users/%s/teams?page=%d&limit=%d", userName, page, limit)

	var res userTeamsResponse
	rsp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodGet,
		Path:   path,
	}, &res)

	require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
	return res
}

func getUserTeamsWithOffset(t *testing.T, helper *apis.K8sTestHelper, userName string, offset, limit int) userTeamsResponse {
	path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/default/users/%s/teams?offset=%d&limit=%d", userName, offset, limit)

	var res userTeamsResponse
	rsp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodGet,
		Path:   path,
	}, &res)

	require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
	return res
}
