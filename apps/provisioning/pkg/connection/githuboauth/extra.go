package githuboauth

import (
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/oauth"
)

func Extra(decrypter connection.Decrypter) connection.Extra {
	return oauth.Extra(decrypter, provisioning.GithubOAuthConnectionType, fromConnection, Mutate, Validate)
}

func fromConnection(c *provisioning.Connection) (oauth.Provider, string, bool) {
	if c.Spec.GitHubOAuth == nil {
		return nil, "", false
	}
	return Provider{}, c.Spec.GitHubOAuth.ClientID, true
}
