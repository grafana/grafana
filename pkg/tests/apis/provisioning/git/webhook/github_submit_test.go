package webhook

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common/webhooksuite"
)

func TestIntegrationProvisioning_GithubSubmitPullRequest(t *testing.T) {
	helper := githubHelper(t)
	const repoName = "github-submit"
	githubMock.CreateRepo(t, helper, repoName, map[string][]byte{
		"dashboard.json": common.DashboardJSON("submit-dash", "Submit Dashboard", 1),
	}, webhooksuite.RepoOptions{})
	repoToken := helper.GithubTransportUser(t).Password

	submit := func(t *testing.T, spec provisioning.PullRequestSubmissionSpec) (*provisioning.PullRequestSubmission, int, error) {
		t.Helper()
		body, err := json.Marshal(&provisioning.PullRequestSubmission{Spec: spec})
		require.NoError(t, err)

		var statusCode int
		result := helper.EditorREST.Post().
			Namespace(helper.Namespace).
			Resource("repositories").
			Name(repoName).
			SubResource("submit").
			Body(body).
			SetHeader("Content-Type", "application/json").
			Do(t.Context()).
			StatusCode(&statusCode)
		if result.Error() != nil {
			return nil, statusCode, result.Error()
		}
		raw, err := result.Raw()
		require.NoError(t, err)
		res := &provisioning.PullRequestSubmission{}
		require.NoError(t, json.Unmarshal(raw, res))
		return res, statusCode, nil
	}

	t.Run("opens the pull request with the repository's token", func(t *testing.T) {
		res, statusCode, err := submit(t, provisioning.PullRequestSubmissionSpec{
			Ref:         "grafana-changes",
			Title:       "Update dashboards",
			Description: "Made in Grafana",
		})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, statusCode)
		require.Equal(t, provisioning.PullRequestSubmissionStatus{
			Number: 1,
			URL:    "https://github.example.com/git/" + repoName + "/pull/1",
		}, res.Status)

		pulls := githubMock.OpenedPulls(repoName)
		require.Len(t, pulls, 1)
		require.Equal(t, "Bearer "+repoToken, pulls[0].authorization)
		require.Equal(t, "main", pulls[0].pull.GetBase())
		require.Equal(t, "grafana-changes", pulls[0].pull.GetHead())
		require.Equal(t, "Update dashboards", pulls[0].pull.GetTitle())
		require.Equal(t, "Made in Grafana", pulls[0].pull.GetBody())
	})

	t.Run("rejects submitting the repository branch", func(t *testing.T) {
		_, statusCode, err := submit(t, provisioning.PullRequestSubmissionSpec{Ref: "main", Title: "Update dashboards"})
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, statusCode)
	})
}
