package github

import (
	"context"
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

func (r *Factory) New(ctx context.Context, owner, repo string, ghToken common.RawSecureValue) Client {
	if r.Client != nil {
		return NewClient(github.NewClient(r.Client), owner, repo)
	}

	if !ghToken.IsZero() {
		tokenSrc := oauth2.StaticTokenSource(
			&oauth2.Token{AccessToken: string(ghToken)},
		)
		tokenClient := oauth2.NewClient(ctx, tokenSrc)
		return NewClient(github.NewClient(tokenClient), owner, repo)
	}

	return NewClient(github.NewClient(&http.Client{}), owner, repo)
}
