package handler

import (
	"context"

	"github.com/ory/x/errorsx"

	"github.com/ory/fosite"
	"github.com/ory/fosite/handler/openid"
)

// #nosec:gosec G101 - False Positive
const grantTypeJWTBearer = "urn:ietf:params:oauth:grant-type:jwt-bearer"

type OpenIDConnectRFC7523Handler struct {
	Config interface {
		fosite.IDTokenLifespanProvider
		fosite.GrantTypeJWTBearerCanSkipClientAuthProvider
	}

	*openid.IDTokenHandleHelper
}

var _ fosite.TokenEndpointHandler = (*OpenIDConnectRFC7523Handler)(nil)

// HandleTokenEndpointRequest implements https://tools.ietf.org/html/rfc6749#section-4.1.3 (everything) and
// https://tools.ietf.org/html/rfc7523#section-2.1 (everything)
func (c *OpenIDConnectRFC7523Handler) HandleTokenEndpointRequest(ctx context.Context, request fosite.AccessRequester) error {
	return nil
}

func (c *OpenIDConnectRFC7523Handler) PopulateTokenEndpointResponse(ctx context.Context, request fosite.AccessRequester, response fosite.AccessResponder) error {
	if err := c.CheckRequest(ctx, request); err != nil {
		return err
	}

	atLifespan := fosite.GetEffectiveLifespan(request.GetClient(), fosite.GrantTypeJWTBearer, fosite.AccessToken, c.Config.GetIDTokenLifespan(ctx))
	return c.IssueExplicitIDToken(ctx, atLifespan, request, response)
}

func (c *OpenIDConnectRFC7523Handler) CanSkipClientAuth(ctx context.Context, requester fosite.AccessRequester) bool {
	return c.Config.GetGrantTypeJWTBearerCanSkipClientAuth(ctx)
}

func (c *OpenIDConnectRFC7523Handler) CanHandleTokenEndpointRequest(ctx context.Context, requester fosite.AccessRequester) bool {
	// grant_type REQUIRED.
	// Value MUST be set to "urn:ietf:params:oauth:grant-type:jwt-bearer"
	return requester.GetGrantTypes().ExactOne(grantTypeJWTBearer) && requester.GetRequestedScopes().Has("openid")
}

func (c *OpenIDConnectRFC7523Handler) CheckRequest(ctx context.Context, request fosite.AccessRequester) error {
	if !c.CanHandleTokenEndpointRequest(ctx, request) {
		return errorsx.WithStack(fosite.ErrUnknownRequest)
	}

	// Client Authentication is optional:
	//
	// Authentication of the client is optional, as described in
	//   Section 3.2.1 of OAuth 2.0 [RFC6749] and consequently, the
	//   "client_id" is only needed when a form of client authentication that
	//   relies on the parameter is used.

	// if client is authenticated, check grant types
	if !c.CanSkipClientAuth(ctx, request) && !request.GetClient().GetGrantTypes().Has(grantTypeJWTBearer) {
		return errorsx.WithStack(fosite.ErrUnauthorizedClient.WithHintf("The OAuth 2.0 Client is not allowed to use authorization grant \"%s\".", grantTypeJWTBearer))
	}

	return nil
}
