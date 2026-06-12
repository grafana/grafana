package github

import (
	"context"
	"fmt"
	"net/http"

	"github.com/google/go-github/v82/github"
	"golang.org/x/oauth2"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// Factory creates new GitHub clients.
// It exists only for the ability to test the code easily.
type Factory struct {
	// Client allows overriding the client to use in the GH client returned. It exists primarily for testing.
	// FIXME: we should replace in this way. We should add some options pattern for the factory.
	Client *http.Client
}

func ProvideFactory() GithubFactory {
	return &Factory{}
}

func (r *Factory) New(ctx context.Context, ghToken common.RawSecureValue, serverURL string) (Client, error) {
	if r.Client != nil {
		return NewClient(github.NewClient(r.Client)), nil
	}

	httpClient := &http.Client{}
	if !ghToken.IsZero() {
		tokenSrc := oauth2.StaticTokenSource(
			&oauth2.Token{AccessToken: string(ghToken)},
		)
		httpClient = oauth2.NewClient(ctx, tokenSrc)
	}

	ghClient := github.NewClient(httpClient)
	if serverURL != "" {
		enterprise, err := ghClient.WithEnterpriseURLs(serverURL, serverURL)
		if err != nil {
			return nil, fmt.Errorf("configure GitHub Enterprise URLs for %q: %w", serverURL, err)
		}
		ghClient = enterprise
	}

	return NewClient(ghClient), nil
}

var _ GithubFactory = (*Factory)(nil)
