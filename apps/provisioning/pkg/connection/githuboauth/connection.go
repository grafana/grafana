package githuboauth

import (
	"context"
	"fmt"
	"net/http"

	"github.com/google/go-github/v82/github"
	"golang.org/x/oauth2"
	oauth2github "golang.org/x/oauth2/github"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/oauth"
)

// Provider implements the GitHub-specific parts of an OAuth app connection.
type Provider struct {
	clientID string
}

func (p *Provider) RepositoryType() provisioning.RepositoryType {
	return provisioning.GitHubRepositoryType
}

func (p *Provider) Endpoint() oauth2.Endpoint {
	return oauth2github.Endpoint
}

func (p *Provider) ClientID() string {
	return p.clientID
}

func (p *Provider) ListRepositories(ctx context.Context, accessToken string) ([]provisioning.ExternalRepository, error) {
	return ListRepositories(ctx, accessToken, "")
}

// ListRepositories lists the repositories accessible to the OAuth access token.
// A non-empty apiBaseURL points the client at a GitHub Enterprise server.
func ListRepositories(ctx context.Context, accessToken, apiBaseURL string) ([]provisioning.ExternalRepository, error) {
	httpClient := oauth2.NewClient(ctx, oauth2.StaticTokenSource(&oauth2.Token{AccessToken: accessToken}))
	client := github.NewClient(httpClient)
	if apiBaseURL != "" {
		var err error
		client, err = client.WithEnterpriseURLs(apiBaseURL, apiBaseURL)
		if err != nil {
			return nil, fmt.Errorf("create github client: %w", err)
		}
	}

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

var _ oauth.Provider = (*Provider)(nil)
