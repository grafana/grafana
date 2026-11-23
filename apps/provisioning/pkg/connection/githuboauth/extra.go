package githuboauth

import (
	"context"

	"github.com/grafana/grafana-app-sdk/resource"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/oauth"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
)

func Extra(decrypter connection.Decrypter, factory *github.Factory) connection.Extra {
	return oauth.NewExtra(
		decrypter,
		provisioning.ConnectionTypeGithubOAuth,
		provisioning.GitHubRepositoryType,
		func(ctx context.Context, spec provisioning.ConnectionSpec, accessToken string) (oauth.Provider, error) {
			return newProvider(factory, spec, accessToken)
		},
		nil,
	)
}

func newProvider(factory *github.Factory, _ provisioning.ConnectionSpec, accessToken string) (oauth.Provider, error) {
	client, err := factory.New("", "", resource.RawSecureValue(accessToken))
	if err != nil {
		return nil, err
	}
	return &provider{client: client}, nil
}
