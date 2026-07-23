package githuboauth

import (
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/oauth"
)

func Extra(decrypter connection.Decrypter) connection.Extra {
	return oauth.NewExtra(
		decrypter,
		provisioning.GithubOAuthConnectionType,
		provisioning.GitHubRepositoryType,
		newProvider,
		nil,
	)
}

func newProvider(_ provisioning.ConnectionSpec) oauth.Provider {
	return &Provider{}
}
