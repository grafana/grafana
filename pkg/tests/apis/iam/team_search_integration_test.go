package identity

import (
	"context"
	"fmt"
	"net/http"
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

func TestIntegrationTeamSearch(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// TODO: Add rest.Mode3 and rest.Mode4 when they're supported
	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2}
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
					featuremgmt.FlagKubernetesAuthnMutation,
				},
			})
			doTeamSearchTests(t, helper)
		})
	}
}

func doTeamSearchTests(t *testing.T, helper *apis.K8sTestHelper) {
	ctx := context.Background()
	namespace := helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID())

	// Create teams for testing
	teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR:       gvrTeams,
	})

	team1, err := teamClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("testdata/team-test-create-v0.yaml"), metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, team1)

	// Create a second team with a different name
	team2YAML := helper.LoadYAMLOrJSONFile("testdata/team-test-create-v0.yaml")
	team2YAML.Object["metadata"].(map[string]interface{})["name"] = "testteam2"
	team2YAML.Object["spec"].(map[string]interface{})["title"] = "Another Team"
	team2YAML.Object["spec"].(map[string]interface{})["email"] = "anotherteam@example.com"

	team2, err := teamClient.Resource.Create(ctx, team2YAML, metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, team2)

	t.Run("should search teams without query parameter", func(t *testing.T) {
		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/searchTeams", namespace)
		var result iamv0alpha1.TeamSearchResults

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
		var result iamv0alpha1.TeamSearchResults

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
		var result iamv0alpha1.TeamSearchResults

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
		var result iamv0alpha1.TeamSearchResults

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
		var result1 iamv0alpha1.TeamSearchResults

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
		var result2 iamv0alpha1.TeamSearchResults

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
		var result iamv0alpha1.TeamSearchResults

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
}
