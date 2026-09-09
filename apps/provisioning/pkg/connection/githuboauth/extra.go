package githuboauth

import (
	"context"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/oauth"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func Extra(decrypter connection.Decrypter, factory *github.Factory) connection.Extra {
	return oauth.NewExtra(
		decrypter,
		provisioning.GithubOAuthConnectionType,
		provisioning.GitHubRepositoryType,
		func(ctx context.Context, spec provisioning.ConnectionSpec, accessToken string) (oauth.Provider, error) {
			return newProvider(factory, spec, accessToken)
		},
		nil,
	)
}

func newProvider(factory *github.Factory, _ provisioning.ConnectionSpec, accessToken string) (oauth.Provider, error) {
	client, err := factory.New("", "", common.RawSecureValue(accessToken))
	if err != nil {
		return nil, err
	}
	return &provider{client: client}, nil
}
