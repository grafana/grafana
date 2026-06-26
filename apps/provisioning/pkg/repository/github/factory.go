package github

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

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

	// replayCache is the process-wide webhook replay cache. It lives on
	// the factory so a single instance is shared across every per-request
	// githubWebhookRepository the factory ultimately produces.
	replayCache *replayCache
}

func ProvideFactory() *Factory {
	return &Factory{
		replayCache: newReplayCache(defaultReplayCacheTTL),
	}
}

// ClientOptions holds the optional configuration for a GitHub client.
type ClientOptions struct {
	customServerURL string
}

// ClientOption customizes how a GitHub client is created.
type ClientOption func(*ClientOptions)

// WithCustomServerURL resolves a GitHub repo/web URL into the REST API base URL for its
// deployment type and targets the client at it. An empty url or github.com keeps the default
// github.com client.
//
//	GHES (self-hosted):  https://custom-ghe-url.com/owner/repo -> https://custom-ghe-url.com (go-github appends /api/v3)
//	GHEC data residency: https://acme.ghe.com/owner/repo       -> https://api.acme.ghe.com (REST API has no /api/v3 prefix)
//	GHEC standard / EMU: https://github.com/owner/repo         -> "" (default api.github.com client)
//
// The api. prefix on data-residency hosts is also what tells go-github's WithEnterpriseURLs to
// skip appending the /api/v3 path that self-hosted servers require, so the two cases diverge.
func WithCustomServerURL(serverURL string) ClientOption {
	return func(o *ClientOptions) {
		u, err := url.Parse(serverURL)
		if err != nil || u.Host == "" {
			return
		}

		host := u.Hostname()
		if host == "github.com" || host == "www.github.com" {
			return
		}

		if strings.HasSuffix(host, ".ghe.com") && !strings.HasPrefix(host, "api.") {
			o.customServerURL = u.Scheme + "://api." + u.Host
			return
		}

		o.customServerURL = u.Scheme + "://" + u.Host
	}
}

func (r *Factory) New(ctx context.Context, owner, repo string, ghToken common.RawSecureValue, opts ...ClientOption) (Client, error) {
	var options ClientOptions
	for _, opt := range opts {
		opt(&options)
	}

	if r.Client != nil {
		return NewClient(github.NewClient(r.Client), owner, repo), nil
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

	return NewClient(ghClient, owner, repo), nil
}
