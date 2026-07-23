package githuboauth

import (
	"context"
	"fmt"
	"net/http"

	"github.com/google/go-github/v82/github"
	"golang.org/x/oauth2"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/oauth"
)

const tokenURL = "https://github.com/login/oauth/access_token"

// Provider implements the GitHub-specific parts of an OAuth app connection.
type Provider struct{}

func (Provider) Type() provisioning.ConnectionType {
	return provisioning.GithubOAuthConnectionType
}

func (Provider) RepositoryType() provisioning.RepositoryType {
	return provisioning.GitHubRepositoryType
}

func (Provider) TokenURL() string {
	return tokenURL
}

func (Provider) ListRepositories(ctx context.Context, accessToken string) ([]provisioning.ExternalRepository, error) {
	httpClient := oauth2.NewClient(ctx, oauth2.StaticTokenSource(&oauth2.Token{AccessToken: accessToken}))
	client := github.NewClient(httpClient)

	opts := &github.RepositoryListByAuthenticatedUserOptions{
		ListOptions: github.ListOptions{PerPage: 100},
	}

	var result []provisioning.ExternalRepository
	for {
		repos, resp, err := client.Repositories.ListByAuthenticatedUser(ctx, opts)
		if err != nil {
			if resp != nil && (resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden) {
				return nil, connection.ErrAuthentication
			}
			return nil, fmt.Errorf("list repositories: %w", err)
		}

		for _, r := range repos {
			result = append(result, provisioning.ExternalRepository{
				Name:  r.GetName(),
				Owner: r.GetOwner().GetLogin(),
				URL:   r.GetHTMLURL(),
			})
		}

		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}

	return result, nil
}

var _ oauth.Provider = Provider{}
