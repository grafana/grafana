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

type teamMembersResponse struct {
	Items []struct {
		User       string `json:"user"`
		Team       string `json:"team"`
		Permission string `json:"permission"`
		External   bool   `json:"external"`
	} `json:"items"`
}

func TestIntegrationTeamMembers(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}

	for _, mode := range modes {
		t.Run(fmt.Sprintf("With dual writer mode %d", mode), func(t *testing.T) {
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
					featuremgmt.FlagKubernetesTeamBindings,
				},
				UnifiedStorageEnableSearch: true,
			})

			t.Cleanup(func() { helper.Shutdown() })

			doTeamMembersTests(t, helper)
		})
	}
}

func doTeamMembersTests(t *testing.T, helper *apis.K8sTestHelper) {
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

	// Create team1 - will have 5 members
	team1, err := teamClient.Resource.Create(ctx, createTeamObject(helper, "team-1", "Team 1", "team-1@example.com"), metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, team1)

	// Create team2 - no members
	team2, err := teamClient.Resource.Create(ctx, createTeamObject(helper, "team-no-members", "Team No Members", "team-none@example.com"), metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, team2)

	// Create 5 users
	users := make([]*unstructured.Unstructured, 0, 5)
	for i := 1; i <= 5; i++ {
		uObj := helper.LoadYAMLOrJSONFile("testdata/user-test-create-v0.yaml")
		uObj.Object["metadata"].(map[string]any)["name"] = fmt.Sprintf("user-member-%d", i)
		uObj.Object["spec"].(map[string]any)["login"] = fmt.Sprintf("user-member-%d", i)
		uObj.Object["spec"].(map[string]any)["email"] = fmt.Sprintf("user-member-%d@example.com", i)

		u, err := userClient.Resource.Create(ctx, uObj, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, u)
		users = append(users, u)
	}

	// Create team bindings: all 5 users -> team1
	for _, u := range users {
		tbObj := createTeamBindingObject(helper, u.GetName(), team1.GetName())
		_, err := tbClient.Resource.Create(ctx, tbObj, metav1.CreateOptions{})
		require.NoError(t, err)
	}

	t.Run("returns the bound members for the team", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/default/teams/%s/members", team1.GetName())

		var res teamMembersResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &res)

		require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
		require.True(t, containsMember(res, users[0].GetName()), "expected response to contain member %q, got %#v", users[0].GetName(), res.Items)

		item := findMember(res, users[0].GetName())
		require.Equal(t, team1.GetName(), item.Team)
		require.Equal(t, "admin", item.Permission)
		require.False(t, item.External)
	})

	t.Run("does not return members for a team with no bindings", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/default/teams/%s/members", team2.GetName())

		var res teamMembersResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &res)

		require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
		require.False(t, containsMember(res, users[0].GetName()), "did not expect response to contain member %q, got %#v", users[0].GetName(), res.Items)
		require.Len(t, res.Items, 0)
	})

	t.Run("paging with page and limit", func(t *testing.T) {
		// Page 1, Limit 2
		res1 := getTeamMembersWithPaging(t, helper, team1.GetName(), 1, 2)
		require.Len(t, res1.Items, 2)

		// Page 2, Limit 2
		res2 := getTeamMembersWithPaging(t, helper, team1.GetName(), 2, 2)
		require.Len(t, res2.Items, 2)

		// Page 3, Limit 2
		res3 := getTeamMembersWithPaging(t, helper, team1.GetName(), 3, 2)
		require.Len(t, res3.Items, 1)

		seen := make(map[string]bool)
		for _, item := range res1.Items {
			require.False(t, seen[item.User], "Member %s seen in page 1 twice", item.User)
			seen[item.User] = true
		}
		for _, item := range res2.Items {
			require.False(t, seen[item.User], "Member %s seen in page 1 and 2", item.User)
			seen[item.User] = true
		}
		for _, item := range res3.Items {
			require.False(t, seen[item.User], "Member %s seen in previous pages", item.User)
			seen[item.User] = true
		}
		require.Len(t, seen, 5, "Should have seen all 5 members across pages")
	})

	t.Run("paging with offset and limit", func(t *testing.T) {
		// Offset 0, Limit 2
		res1 := getTeamMembersWithOffset(t, helper, team1.GetName(), 0, 2)
		require.Len(t, res1.Items, 2)

		// Offset 2, Limit 2
		res2 := getTeamMembersWithOffset(t, helper, team1.GetName(), 2, 2)
		require.Len(t, res2.Items, 2)

		// Offset 4, Limit 2
		res3 := getTeamMembersWithOffset(t, helper, team1.GetName(), 4, 2)
		require.Len(t, res3.Items, 1)

		seen := make(map[string]bool)
		for _, item := range res1.Items {
			require.False(t, seen[item.User], "Member %s seen in offset 0 twice", item.User)
			seen[item.User] = true
		}
		for _, item := range res2.Items {
			require.False(t, seen[item.User], "Member %s seen in offset 0 and 2", item.User)
			seen[item.User] = true
		}
		for _, item := range res3.Items {
			require.False(t, seen[item.User], "Member %s seen in previous offsets", item.User)
			seen[item.User] = true
		}
		require.Len(t, seen, 5, "Should have seen all 5 members across offsets")
	})
}

func containsMember(res teamMembersResponse, userName string) bool {
	for _, it := range res.Items {
		if it.User == userName {
			return true
		}
	}
	return false
}

func findMember(res teamMembersResponse, userName string) (out struct {
	User       string `json:"user"`
	Team       string `json:"team"`
	Permission string `json:"permission"`
	External   bool   `json:"external"`
}) {
	for _, it := range res.Items {
		if it.User == userName {
			return it
		}
	}
	return out
}

func getTeamMembersWithPaging(t *testing.T, helper *apis.K8sTestHelper, teamName string, page, limit int) teamMembersResponse {
	path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/default/teams/%s/members?page=%d&limit=%d", teamName, page, limit)

	var res teamMembersResponse
	rsp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodGet,
		Path:   path,
	}, &res)

	require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
	return res
}

func getTeamMembersWithOffset(t *testing.T, helper *apis.K8sTestHelper, teamName string, offset, limit int) teamMembersResponse {
	path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/default/teams/%s/members?offset=%d&limit=%d", teamName, offset, limit)

	var res teamMembersResponse
	rsp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodGet,
		Path:   path,
	}, &res)

	require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
	return res
}
