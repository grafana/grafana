package github

import (
	"context"
	"net/http"

	"github.com/google/go-github/v70/github"
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

func (r *Factory) New(ctx context.Context, ghToken common.RawSecureValue) Client {
	if r.Client != nil {
		return NewClient(github.NewClient(r.Client))
	}

	if !ghToken.IsZero() {
		tokenSrc := oauth2.StaticTokenSource(
			&oauth2.Token{AccessToken: string(ghToken)},
		)
		tokenClient := oauth2.NewClient(ctx, tokenSrc)
		return NewClient(github.NewClient(tokenClient))
	}

	return NewClient(github.NewClient(&http.Client{}))
}
