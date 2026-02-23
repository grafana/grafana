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
}

func ProvideFactory() *Factory {
	return &Factory{}
}

func (r *Factory) New(ctx context.Context, ghToken common.RawSecureValue, repoURL string) (Client, error) {
	var httpClient *http.Client
	if r.Client != nil {
		httpClient = r.Client
	} else if !ghToken.IsZero() {
		tokenSrc := oauth2.StaticTokenSource(
			&oauth2.Token{AccessToken: string(ghToken)},
		)
		httpClient = oauth2.NewClient(ctx, tokenSrc)
	} else {
		httpClient = &http.Client{}
	}

	ghClient := github.NewClient(httpClient)

	// Check if this is a GitHub Enterprise instance
	baseURL, err := extractEnterpriseBaseURL(repoURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse repository URL: %w", err)
	}

	if baseURL != "" {
		ghClient, err = ghClient.WithEnterpriseURLs(baseURL, baseURL)
		if err != nil {
			return nil, fmt.Errorf("failed to configure GitHub Enterprise URLs: %w", err)
		}
	}

	return NewClient(ghClient), nil
}

// extractEnterpriseBaseURL extracts the base URL for GitHub Enterprise from a repository URL.
// Returns empty string for standard github.com URLs.
func extractEnterpriseBaseURL(repoURL string) (string, error) {
	if repoURL == "" {
		return "", nil
	}

	parsed, err := url.Parse(repoURL)
	if err != nil {
		return "", err
	}

	// Standard GitHub.com - no custom base URL needed
	if strings.EqualFold(parsed.Host, "github.com") {
		return "", nil
	}

	// GitHub Enterprise - construct base URL
	return fmt.Sprintf("%s://%s", parsed.Scheme, parsed.Host), nil
}
