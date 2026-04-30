package user

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
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
	Metadata struct {
		Continue string `json:"continue"`
	} `json:"metadata"`
	Items []struct {
		Team       string `json:"team"`
		User       string `json:"user"`
		Permission string `json:"permission"`
		External   bool   `json:"external"`
	} `json:"items"`
}

func TestIntegrationUserTeams(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode5}

	for _, mode := range modes {
		t.Run(fmt.Sprintf("With dual writer mode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:      false,
				DisableAnonymous:       true,
				RBACSingleOrganization: true,
				APIServerStorageType:   "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"users.iam.grafana.app": {
						DualWriterMode: mode,
					},
					"teams.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesTeamsApi,
					featuremgmt.FlagKubernetesTeamBindings,
					featuremgmt.FlagKubernetesUsersApi,
				},
			})

			t.Cleanup(func() { helper.Shutdown() })

			doUserTeamsTests(t, helper)
		})
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

	// Create u1 - will be bound to all 5 teams
	u1, err := userClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/user-test-create-v0.yaml"), metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, u1)

	// Create u2 - no bindings
	u2Obj := helper.LoadYAMLOrJSONFile("../testdata/user-test-create-v0.yaml")
	u2Obj.Object["metadata"].(map[string]any)["name"] = "user-no-binding"
	u2Obj.Object["spec"].(map[string]any)["login"] = "user-no-binding"
	u2Obj.Object["spec"].(map[string]any)["email"] = "user-no-binding@example.com"

	u2, err := userClient.Resource.Create(ctx, u2Obj, metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, u2)

	// Create 5 teams and add u1 as a member via spec.members. Alternate
	// admin/member so the response permission strings are exercised across
	// both legacy (Mode 0/1) and unified (Mode 5) paths.
	teams := make([]*unstructured.Unstructured, 0, 5)
	teamPermissions := []string{"admin", "member", "admin", "member", "admin"}
	for i := 1; i <= 5; i++ {
		teamObj := createTeamObject(helper,
			fmt.Sprintf("team-%d", i),
			fmt.Sprintf("Team %d", i),
			fmt.Sprintf("team-%d@example.com", i),
		)
		team, err := teamClient.Resource.Create(ctx, teamObj, metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, team)

		require.NoError(t, unstructured.SetNestedSlice(team.Object, []interface{}{
			map[string]interface{}{
				"kind":       "User",
				"name":       u1.GetName(),
				"permission": teamPermissions[i-1],
				"external":   false,
			},
		}, "spec", "members"))
		team, err = teamClient.Resource.Update(ctx, team, metav1.UpdateOptions{})
		require.NoError(t, err)
		teams = append(teams, team)
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
		require.Equal(t, u1.GetName(), item.User)
		require.Equal(t, teams[0].GetName(), item.Team)
		require.Equal(t, "admin", item.Permission)
		require.False(t, item.External)
	})

	t.Run("permission strings round-trip across both paths", func(t *testing.T) {
		// Guards against legacy/unified divergence: the legacy adapter maps
		// team.PermissionType via common.MapTeamPermission, while the unified
		// path emits string(spec.members[i].Permission). Both must produce
		// the same lowercase enum values for every dual-writer mode.
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/default/users/%s/teams", u1.GetName())

		var res userTeamsResponse
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &res)
		require.Equal(t, http.StatusOK, rsp.Response.StatusCode)

		for i, expected := range teamPermissions {
			teamName := teams[i].GetName()
			item := findTeam(res, teamName)
			require.Equal(t, teamName, item.Team, "expected team %q in response, got %#v", teamName, res.Items)
			require.Equal(t, expected, item.Permission, "team %q: expected permission %q, got %q", teamName, expected, item.Permission)
		}
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

	t.Run("paging with continue token", func(t *testing.T) {
		// Walk all 5 teams in pages of 2 using metadata.continue. The token
		// encodes the last team UID seen on the previous page so the next
		// request resumes after it (keyset pagination — stable across
		// concurrent insert/delete on the membership set).
		seen := make(map[string]bool)
		cont := ""
		pages := 0
		for {
			res := getUserTeamsWithContinue(t, helper, u1.GetName(), 2, cont)
			pages++
			for _, item := range res.Items {
				require.False(t, seen[item.Team], "team %q seen on multiple pages", item.Team)
				seen[item.Team] = true
			}
			if res.Metadata.Continue == "" {
				break
			}
			cont = res.Metadata.Continue
			require.LessOrEqual(t, pages, 10, "runaway pagination loop")
		}
		require.Len(t, seen, 5, "should have seen all 5 teams across pages")
	})
}

func createTeamObject(helper *apis.K8sTestHelper, teamName string, title string, email string) *unstructured.Unstructured {
	teamObj := helper.LoadYAMLOrJSONFile("../testdata/team-test-create-v0.yaml")
	teamObj.Object["metadata"].(map[string]any)["name"] = teamName
	teamObj.Object["spec"].(map[string]any)["title"] = title
	teamObj.Object["spec"].(map[string]any)["email"] = email

	return teamObj
}

func containsTeam(res userTeamsResponse, teamName string) bool {
	for _, it := range res.Items {
		if it.Team == teamName {
			return true
		}
	}
	return false
}

func findTeam(res userTeamsResponse, teamName string) (out struct {
	Team       string `json:"team"`
	User       string `json:"user"`
	Permission string `json:"permission"`
	External   bool   `json:"external"`
}) {
	for _, it := range res.Items {
		if it.Team == teamName {
			return it
		}
	}
	return out
}

func getUserTeamsWithContinue(t *testing.T, helper *apis.K8sTestHelper, userName string, limit int, cont string) userTeamsResponse {
	path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/default/users/%s/teams?limit=%d", userName, limit)
	if cont != "" {
		// Continue tokens are base64 — escape so '+' / '/' / '=' survive
		// the round-trip (otherwise '+' silently decodes to a space on the server).
		path += "&continue=" + url.QueryEscape(cont)
	}

	var res userTeamsResponse
	rsp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodGet,
		Path:   path,
	}, &res)

	require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
	return res
}
