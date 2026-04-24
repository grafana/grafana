package team

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Run with:
//
// go test --tags "pro" -timeout 60s -run ^TestIntegrationTeamSearch$ github.com/grafana/grafana/pkg/tests/apis/iam -count=1
func TestIntegrationTeamSearch(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("Team search with dual writer mode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    false,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"teams.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesTeamsApi,
				},
			})
			doTeamSearchTests(t, helper, mode)
		})
	}
}

func doTeamSearchTests(t *testing.T, helper *apis.K8sTestHelper, mode rest.DualWriterMode) {
	ctx := context.Background()
	namespace := helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID())

	// Create teams for testing
	teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR:       gvrTeams,
	})

	team1, err := teamClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/team-test-create-v0.yaml"), metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, team1)

	team2YAML := helper.LoadYAMLOrJSONFile("../testdata/team-test-create-v0.yaml")
	team2YAML.Object["metadata"].(map[string]interface{})["name"] = "testteam2"
	team2YAML.Object["spec"].(map[string]interface{})["title"] = "Another Team"
	team2YAML.Object["spec"].(map[string]interface{})["email"] = "anotherteam@example.com"

	team2, err := teamClient.Resource.Create(ctx, team2YAML, metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, team2)

	t.Run("should search teams without query parameter", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams", namespace)
		var result iamv0alpha1.GetSearchTeamsResponse

		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.NotNil(t, response)
		require.Equal(t, http.StatusOK, response.Response.StatusCode)
		require.NotNil(t, response.Result)
		require.GreaterOrEqual(t, result.TotalHits, int64(2), "should find at least 2 teams")
		require.GreaterOrEqual(t, len(result.Hits), 2, "should return at least 2 hits")

		for _, hit := range result.Hits {
			if hit.Name == team1.GetName() {
				require.Equal(t, "Test Team 1", hit.Title)
				require.Equal(t, "testteam1@example123.com", hit.Email)
			}
			if hit.Name == team2.GetName() {
				require.Equal(t, "Another Team", hit.Title)
				require.Equal(t, "anotherteam@example.com", hit.Email)
			}
		}
	})

	t.Run("should search teams with query parameter", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?query=another", namespace)
		var result iamv0alpha1.GetSearchTeamsResponse

		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.NotNil(t, response)
		require.Equal(t, http.StatusOK, response.Response.StatusCode)
		require.NotNil(t, response.Result)
		require.Equal(t, result.TotalHits, int64(1), "should find 1 team matching 'another'")
		require.Equal(t, len(result.Hits), 1, "should return 1 hit")
		require.Equal(t, result.Hits[0].Name, team2.GetName())
		require.Equal(t, result.Hits[0].Title, "Another Team")
		require.Equal(t, result.Hits[0].Email, "anotherteam@example.com")
	})

	t.Run("should return no results when query does not match any teams", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?query=nonexistent", namespace)
		var result iamv0alpha1.GetSearchTeamsResponse

		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.NotNil(t, response)
		require.Equal(t, http.StatusOK, response.Response.StatusCode)
		require.NotNil(t, response.Result)
		require.Equal(t, int64(0), result.TotalHits, "should return 0 hits when query does not match any teams")
		require.Equal(t, 0, len(result.Hits), "should return 0 hits when query does not match any teams")
	})

	t.Run("should search teams with limit parameter", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?limit=1", namespace)
		var result iamv0alpha1.GetSearchTeamsResponse

		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.NotNil(t, response)
		require.Equal(t, http.StatusOK, response.Response.StatusCode)
		require.NotNil(t, response.Result)
		require.Equal(t, 1, len(result.Hits), "should return 1 hit when limit is 1")
	})

	t.Run("should search teams with pagination", func(t *testing.T) {
		// First page
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?limit=1&page=1", namespace)
		var result1 iamv0alpha1.GetSearchTeamsResponse

		response1 := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result1)

		require.NotNil(t, response1)
		require.Equal(t, http.StatusOK, response1.Response.StatusCode)
		require.NotNil(t, response1.Result)
		require.Equal(t, int64(0), result1.Offset, "first page should have offset 0")

		// Second page
		path2 := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?limit=1&page=2", namespace)
		var result2 iamv0alpha1.GetSearchTeamsResponse

		response2 := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path2,
		}, &result2)

		require.NotNil(t, response2)
		require.Equal(t, http.StatusOK, response2.Response.StatusCode)
		require.NotNil(t, response2.Result)
		require.Equal(t, int64(1), result2.Offset, "second page should have offset 1")
	})

	t.Run("should search teams with offset parameter", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?offset=1&limit=1", namespace)
		var result iamv0alpha1.GetSearchTeamsResponse

		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.NotNil(t, response)
		require.Equal(t, http.StatusOK, response.Response.StatusCode)
		require.NotNil(t, response.Result)
		require.GreaterOrEqual(t, result.TotalHits, int64(2), "should find at least 2 teams")
		require.Equal(t, 1, len(result.Hits), "should return 1 hit")
		require.Equal(t, int64(1), result.Offset, "should return offset 1")
	})

	t.Run("should filter teams by exact title case-insensitive", func(t *testing.T) {
		titles := []string{"Test Team 1", "test team 1", "TEST TEAM 1", "tEsT tEaM 1"}
		for _, title := range titles {
			t.Run(title, func(t *testing.T) {
				path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?title=%s", namespace, url.QueryEscape(title))
				var result iamv0alpha1.GetSearchTeamsResponse

				response := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: http.MethodGet,
					Path:   path,
				}, &result)

				require.NotNil(t, response)
				require.Equal(t, http.StatusOK, response.Response.StatusCode)
				require.NotNil(t, response.Result)
				require.Equal(t, int64(1), result.TotalHits, "should find exactly 1 team with title '%s'", title)
				require.Equal(t, 1, len(result.Hits), "should return 1 hit")
				require.Equal(t, team1.GetName(), result.Hits[0].Name)
				require.Equal(t, "Test Team 1", result.Hits[0].Title)
			})
		}
	})

	t.Run("should return no results when title does not match any team", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?title=%s", namespace, url.QueryEscape("Nonexistent Team"))
		var result iamv0alpha1.GetSearchTeamsResponse

		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.NotNil(t, response)
		require.Equal(t, http.StatusOK, response.Response.StatusCode)
		require.NotNil(t, response.Result)
		require.Equal(t, int64(0), result.TotalHits, "should find no teams")
		require.Equal(t, 0, len(result.Hits), "should return 0 hits")
	})

	t.Run("should not match partial title", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?title=%s", namespace, url.QueryEscape("Test"))
		var result iamv0alpha1.GetSearchTeamsResponse

		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.NotNil(t, response)
		require.Equal(t, http.StatusOK, response.Response.StatusCode)
		require.NotNil(t, response.Result)
		require.Equal(t, int64(0), result.TotalHits, "partial title should not match (exact match only)")
		require.Equal(t, 0, len(result.Hits), "should return 0 hits for partial title")
	})

	t.Run("should return error when both title and query are provided", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?title=%s&query=Test", namespace, url.QueryEscape("Test Team 1"))
		var result iamv0alpha1.GetSearchTeamsResponse

		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.NotNil(t, response)
		require.Equal(t, http.StatusBadRequest, response.Response.StatusCode)
	})

	t.Run("should filter teams by UID", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?uid=%s", namespace, team1.GetName())
		var result iamv0alpha1.GetSearchTeamsResponse

		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.NotNil(t, response)
		require.Equal(t, http.StatusOK, response.Response.StatusCode)
		require.NotNil(t, response.Result)
		require.Len(t, result.Hits, 1, "should return exactly 1 hit by UID")
		require.Equal(t, team1.GetName(), result.Hits[0].Name)
	})

	t.Run("should filter teams by multiple UIDs", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?uid=%s&uid=%s", namespace, team1.GetName(), team2.GetName())
		var result iamv0alpha1.GetSearchTeamsResponse

		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.NotNil(t, response)
		require.Equal(t, http.StatusOK, response.Response.StatusCode)
		require.NotNil(t, response.Result)
		require.Len(t, result.Hits, 2, "should return both teams by UIDs")
	})

	t.Run("should filter teams by legacy team ID", func(t *testing.T) {
		if mode == rest.Mode5 {
			t.Skip("legacy team IDs are not available in unified-only mode")
		}
		team1LegacyID := team1.GetLabels()["grafana.app/deprecatedInternalID"]
		require.NotEmpty(t, team1LegacyID, "team1 should have a legacy ID label")

		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?teamId=%s", namespace, team1LegacyID)
		var result iamv0alpha1.GetSearchTeamsResponse

		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.NotNil(t, response)
		require.Equal(t, http.StatusOK, response.Response.StatusCode)
		require.NotNil(t, response.Result)
		require.Len(t, result.Hits, 1, "should return exactly 1 hit by legacy ID")
		require.Equal(t, team1.GetName(), result.Hits[0].Name)
	})

	t.Run("should filter teams by multiple legacy team IDs", func(t *testing.T) {
		if mode == rest.Mode5 {
			t.Skip("legacy team IDs are not available in unified-only mode")
		}
		team1LegacyID := team1.GetLabels()["grafana.app/deprecatedInternalID"]
		require.NotEmpty(t, team1LegacyID, "team1 should have a legacy ID label")
		team2LegacyID := team2.GetLabels()["grafana.app/deprecatedInternalID"]
		require.NotEmpty(t, team2LegacyID, "team2 should have a legacy ID label")

		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?teamId=%s&teamId=%s", namespace, team1LegacyID, team2LegacyID)
		var result iamv0alpha1.GetSearchTeamsResponse

		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.NotNil(t, response)
		require.Equal(t, http.StatusOK, response.Response.StatusCode)
		require.NotNil(t, response.Result)
		require.Len(t, result.Hits, 2, "should return both teams by legacy IDs")
	})

	t.Run("should return no results for non-existent UID", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?uid=nonexistent-uid", namespace)
		var result iamv0alpha1.GetSearchTeamsResponse

		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.NotNil(t, response)
		require.Equal(t, http.StatusOK, response.Response.StatusCode)
		require.NotNil(t, response.Result)
		require.Len(t, result.Hits, 0, "should return 0 hits for non-existent UID")
	})

	t.Run("should return error when both uid and teamId are provided", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?uid=%s&teamId=1", namespace, team1.GetName())
		var result iamv0alpha1.GetSearchTeamsResponse

		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.NotNil(t, response)
		require.Equal(t, http.StatusBadRequest, response.Response.StatusCode)
	})

	t.Run("should return error when uid count exceeds maximum", func(t *testing.T) {
		params := make([]string, 101)
		for i := range params {
			params[i] = fmt.Sprintf("uid=uid-%d", i)
		}
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?%s", namespace, strings.Join(params, "&"))
		var result iamv0alpha1.GetSearchTeamsResponse

		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.NotNil(t, response)
		require.Equal(t, http.StatusBadRequest, response.Response.StatusCode)
	})

	t.Run("should return error when teamId count exceeds maximum", func(t *testing.T) {
		params := make([]string, 101)
		for i := range params {
			params[i] = fmt.Sprintf("teamId=%d", i+1)
		}
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?%s", namespace, strings.Join(params, "&"))
		var result iamv0alpha1.GetSearchTeamsResponse

		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.NotNil(t, response)
		require.Equal(t, http.StatusBadRequest, response.Response.StatusCode)
	})

	t.Run("should return error when teamId is not a valid integer", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?teamId=notanumber", namespace)
		var result iamv0alpha1.GetSearchTeamsResponse

		response := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.NotNil(t, response)
		require.Equal(t, http.StatusBadRequest, response.Response.StatusCode)
	})
}

func TestIntegrationTeamSearch_MemberCount(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("DualWriterMode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:      false,
				DisableAnonymous:       true,
				RBACSingleOrganization: true,
				APIServerStorageType:   "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"teams.iam.grafana.app": {
						DualWriterMode: mode,
					},
					"teambindings.iam.grafana.app": {
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

			doTeamSearchMemberCountTests(t, helper)
		})
	}
}

func doTeamSearchMemberCountTests(t *testing.T, helper *apis.K8sTestHelper) {
	ctx := context.Background()
	namespace := helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID())

	teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR:       gvrTeams,
	})
	userClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR:       gvrUsers,
	})
	tbClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR:       gvrTeamBindings,
	})

	// Create teamA with 3 members
	teamA, err := teamClient.Resource.Create(ctx, createTeamObject(helper, "mc-team-a", "MemberCount Team A", "mc-team-a@example.com"), metav1.CreateOptions{})
	require.NoError(t, err)

	// Create teamB with 0 members
	teamB, err := teamClient.Resource.Create(ctx, createTeamObject(helper, "mc-team-b", "MemberCount Team B", "mc-team-b@example.com"), metav1.CreateOptions{})
	require.NoError(t, err)

	// Create 3 users and bind them to teamA
	for i := 1; i <= 3; i++ {
		uObj := helper.LoadYAMLOrJSONFile("../testdata/user-test-create-v0.yaml")
		uObj.Object["metadata"].(map[string]any)["name"] = fmt.Sprintf("mc-user-%d", i)
		uObj.Object["spec"].(map[string]any)["login"] = fmt.Sprintf("mc-user-%d", i)
		uObj.Object["spec"].(map[string]any)["email"] = fmt.Sprintf("mc-user-%d@example.com", i)

		u, err := userClient.Resource.Create(ctx, uObj, metav1.CreateOptions{})
		require.NoError(t, err)

		tbObj := createTeamBindingObject(helper, u.GetName(), teamA.GetName())
		_, err = tbClient.Resource.Create(ctx, tbObj, metav1.CreateOptions{})
		require.NoError(t, err)
	}

	t.Run("should return correct member counts for teams with and without members", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?query=MemberCount&membercount=true", namespace)
		var result iamv0alpha1.GetSearchTeamsResponse

		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
		require.Len(t, result.Hits, 2)

		for _, hit := range result.Hits {
			switch hit.Name {
			case teamA.GetName():
				require.NotNil(t, hit.MemberCount, "teamA should have member count set")
				require.Equal(t, int64(3), *hit.MemberCount, "teamA should have 3 members")
			case teamB.GetName():
				require.NotNil(t, hit.MemberCount, "teamB should have member count set")
				require.Equal(t, int64(0), *hit.MemberCount, "teamB should have 0 members")
			default:
				t.Errorf("unexpected team in results: %s", hit.Name)
			}
		}
	})

	t.Run("should not return member counts when membercount param is absent", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?query=MemberCount", namespace)
		var result iamv0alpha1.GetSearchTeamsResponse

		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
		require.Len(t, result.Hits, 2)

		for _, hit := range result.Hits {
			require.Nil(t, hit.MemberCount, "member count should be nil when membercount param is absent for team %s", hit.Name)
		}
	})

	t.Run("should not return member counts when membercount=false", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?query=MemberCount&membercount=false", namespace)
		var result iamv0alpha1.GetSearchTeamsResponse

		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodGet,
			Path:   path,
		}, &result)

		require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
		require.Len(t, result.Hits, 2)

		for _, hit := range result.Hits {
			require.Nil(t, hit.MemberCount, "member count should be nil when membercount=false for team %s", hit.Name)
		}
	})
}

func TestIntegrationTeamSearch_AccessControl(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("DualWriterMode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    false,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"teams.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesTeamsApi,
				},
			})

			t.Cleanup(func() {
				helper.Shutdown()
			})

			ctx := context.Background()
			namespace := helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID())

			teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
				User:      helper.Org1.Admin,
				Namespace: namespace,
				GVR:       gvrTeams,
			})

			team1, err := teamClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/team-test-create-v0.yaml"), metav1.CreateOptions{})
			require.NoError(t, err)
			require.NotNil(t, team1)

			t.Run("accesscontrol=true includes permissions on hits", func(t *testing.T) {
				res := searchTeamsWithAccessControl(t, helper, namespace, "", true)
				require.GreaterOrEqual(t, len(res.Hits), 1)
				for _, hit := range res.Hits {
					require.NotNil(t, hit.AccessControl, "expected AccessControl map on hit %s", hit.Name)
					require.True(t, hit.AccessControl["teams:read"], "admin should have teams:read on %s", hit.Name)
				}
			})

			t.Run("accesscontrol absent omits permissions from hits", func(t *testing.T) {
				res := searchTeamsWithAccessControl(t, helper, namespace, "", false)
				require.GreaterOrEqual(t, len(res.Hits), 1)
				for _, hit := range res.Hits {
					require.Empty(t, hit.AccessControl, "expected no AccessControl on hit %s when param absent", hit.Name)
				}
			})
		})
	}
}

func searchTeamsWithAccessControl(t *testing.T, helper *apis.K8sTestHelper, namespace string, query string, accessControl bool) *iamv0alpha1.GetSearchTeamsResponse {
	q := url.Values{}
	if query != "" {
		q.Set("query", query)
	}
	q.Set("limit", "100")
	if accessControl {
		q.Set("accesscontrol", "true")
	}

	path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams?%s", namespace, q.Encode())

	res := &iamv0alpha1.GetSearchTeamsResponse{}
	rsp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodGet,
		Path:   path,
	}, res)

	require.Equal(t, 200, rsp.Response.StatusCode)
	return res
}
