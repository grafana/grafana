package githuboauth

import (
	"net/http"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/oauth"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/github"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// Default holds the process-wide provider configuration. Client allows
// overriding the HTTP client used for the token exchange and GitHub API
// calls. It exists primarily for testing.
var Default = struct {
	Client *http.Client
}{}

func Extra(decrypter connection.Decrypter) connection.Extra {
	return oauth.NewExtra(
		decrypter,
		provisioning.GithubOAuthConnectionType,
		provisioning.GitHubRepositoryType,
		newProvider,
		nil,
	)
}

func newProvider(_ provisioning.ConnectionSpec, accessToken string) (oauth.Provider, error) {
	factory := github.ProvideFactory()
	factory.Client = Default.Client
	client, err := factory.New("", "", common.RawSecureValue(accessToken))
	if err != nil {
		return nil, err
	}
	return &provider{httpClient: Default.Client, client: client}, nil
}
