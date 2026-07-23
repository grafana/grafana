package githuboauth

import (
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/oauth"
)

func Extra(decrypter connection.Decrypter) connection.Extra {
	return oauth.Extra(decrypter, provisioning.GithubOAuthConnectionType, fromConnection, nil)
}

var provider = oauth.Provider{
	RepositoryType:   provisioning.GitHubRepositoryType,
	TokenURL:         "https://github.com/login/oauth/access_token",
	AppURL:           "https://github.com/settings/developers",
	ListRepositories: listRepositories,
}

func fromConnection(c *provisioning.Connection) (oauth.Provider, string, bool) {
	if c.Spec.GitHubOAuth == nil {
		return oauth.Provider{}, "", false
	}
	return provider, c.Spec.GitHubOAuth.ClientID, true
}
