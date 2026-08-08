package githuboauth

import (
	"context"
	"errors"
	"net/http"

	"golang.org/x/oauth2"
	oauth2github "golang.org/x/oauth2/github"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/oauth"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
)

// provider implements the GitHub-specific parts of an OAuth app connection.
type provider struct {
	httpClient *http.Client
	client     github.Client
}

// HTTPClient returns the overriding HTTP client, if any. It exists primarily
// for testing: the oauth exchange honors it in place of the default transport.
func (p *provider) HTTPClient() *http.Client {
	return p.httpClient
}

func (p *provider) Endpoint() oauth2.Endpoint {
	return oauth2github.Endpoint
}

func (p *provider) ListRepositories(ctx context.Context) ([]provisioning.ExternalRepository, error) {
	repos, err := p.client.ListRepositories(ctx)
	if err != nil {
		if errors.Is(err, repository.ErrUnauthorized) || errors.Is(err, repository.ErrPermissionDenied) {
			return nil, connection.ErrAuthentication
		}
		return nil, err
	}
	return repos, nil
}

var _ oauth.Provider = (*provider)(nil)
