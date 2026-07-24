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

// ClientOptions holds the optional configuration for a GitHub client.
type ClientOptions struct {
	customServerURL string
}

// ClientOption customizes how a GitHub client is created.
type ClientOption func(*ClientOptions)

// WithCustomServerURL targets a GitHub Enterprise instance at the given REST API
// base URL. An empty url is ignored, keeping the default github.com client.
func WithCustomServerURL(url string) ClientOption {
	return func(o *ClientOptions) {
		o.customServerURL = url
	}
}

func (r *Factory) New(ctx context.Context, ghToken common.RawSecureValue, opts ...ClientOption) (Client, error) {
	var options ClientOptions
	for _, opt := range opts {
		opt(&options)
	}

	if r.Client != nil {
		ghClient := github.NewClient(r.Client)
		if options.customServerURL != "" {
			enterprise, err := ghClient.WithEnterpriseURLs(options.customServerURL, options.customServerURL)
			if err != nil {
				return nil, fmt.Errorf("failed to configure GitHub Enterprise URLs for %q: %w", options.customServerURL, err)
			}
			ghClient = enterprise
		}
		return NewClient(ghClient), nil
	}

	httpClient := &http.Client{}
	if !ghToken.IsZero() {
		tokenSrc := oauth2.StaticTokenSource(
			&oauth2.Token{AccessToken: string(ghToken)},
		)
		httpClient = oauth2.NewClient(ctx, tokenSrc)
	}

	ghClient := github.NewClient(httpClient)
	if options.customServerURL != "" {
		enterprise, err := ghClient.WithEnterpriseURLs(options.customServerURL, options.customServerURL)
		if err != nil {
			return nil, fmt.Errorf("failed to configure GitHub Enterprise URLs for %q: %w", options.customServerURL, err)
		}
		ghClient = enterprise
	}

	return NewClient(ghClient), nil
}

var _ GithubFactory = (*Factory)(nil)
