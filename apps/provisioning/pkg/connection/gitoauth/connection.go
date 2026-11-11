package gitoauth

import (
	"context"

	"golang.org/x/oauth2"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/oauth"
)

type provider struct {
	endpoint oauth2.Endpoint
}

func (p *provider) Endpoint() oauth2.Endpoint {
	return p.endpoint
}

// Test passes without contacting the provider: there is no provider-agnostic
// API to check a token against. The shared OAuth connection already rejects
// missing and expired tokens, and repository health checks verify the token
// against each repository with ls-refs.
func (p *provider) Test(context.Context) *provisioning.TestResults {
	return connection.SuccessTestResults()
}

var _ oauth.Provider = (*provider)(nil)
