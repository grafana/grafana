package v3

import (
	"context"

	"github.com/grafana/authlib/authn"
)

// ClientV3Options configures how requests to a plugin are authenticated.
//
// Experimental: Plugin protocol v3 is a work in progress and may change or be
// removed without notice.
type AuthenticationOptions struct {
	// TokenExchanger exchanges the caller's signed access or ID token for an
	// access token scoped to the request's namespace and audience. Missing
	// caller credentials fail the request; they never fall back to service
	// access, except as allowed by IsServiceIdentity.
	// If nil, NewClientV3 sends no credentials, and plugins that authenticate
	// requests reject them.
	TokenExchanger authn.TokenExchanger

	// PluginID, if set, is the audience of every token, which the plugin accepts
	// for every API group it serves (see ServeOpts.PluginID). Otherwise each
	// token's audience is the request's API group.
	PluginID string

	// Groups lists the API groups the plugin serves. Requests for other groups
	// fail before any token is minted. It is required without PluginID, so a
	// request routed to the wrong plugin cannot hand it a token for another app.
	Groups []string

	// IsServiceIdentity reports whether ctx carries the host's own in-process
	// service identity, which has no signed token to exchange. Such requests
	// use the host's service token instead of a delegated one. Grafana passes
	// identity.IsServiceIdentity. If nil, every request needs a caller token.
	IsServiceIdentity func(ctx context.Context) bool
}
