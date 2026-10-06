package resourceclient

import (
	"context"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/open-feature/go-sdk/openfeature"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
)

var _ authnlib.TokenExchanger = (*onBehalfOfExchanger)(nil)

// onBehalfOfExchanger decorates a TokenExchanger so that storage calls carry the caller
// whose verified access token is in the context, instead of flattening it into the
// plain service exchange:
//   - a user or service account in the token's actor chain becomes the exchange
//     subject, and the exchange is scoped to the caller's namespace;
//   - a service calling on its own behalf becomes the exchange subject, so the signer
//     caps the exchanged token at the caller's permissions.
//
// Every other call, meaning internal service identities without a token of their own
// and classic callers whose ID token the interceptor forwards, passes through to the
// delegate untouched.
type onBehalfOfExchanger struct {
	delegate authnlib.TokenExchanger
	enabled  func(context.Context) bool
}

func (e *onBehalfOfExchanger) Exchange(ctx context.Context, req authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	info, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return e.delegate.Exchange(ctx, req)
	}

	if subject := onBehalfOfSubjectToken(info); subject != "" && e.enabled(ctx) {
		namespace := info.GetNamespace()
		if namespace == "" || namespace == "*" {
			// The signer rejects user exchanges without a concrete namespace; failing here
			// keeps the doomed round trip out of the request path.
			return nil, status.Error(codes.PermissionDenied, "on-behalf-of exchange requires a caller scoped to a single namespace")
		}
		req.SubjectToken = subject
		req.Namespace = namespace
		return e.delegate.Exchange(ctx, req)
	}

	if subject := serviceSubjectToken(info); subject != "" && e.enabled(ctx) {
		req.SubjectToken = subject
		if ns := info.GetNamespace(); ns != "" && ns != "*" {
			req.Namespace = ns
		}
		return e.delegate.Exchange(ctx, req)
	}

	return e.delegate.Exchange(ctx, req)
}

// onBehalfOfSubjectToken returns the caller's access token when the token itself carries
// the caller. Its actor chain ends in a user or service account, making it usable as an
// on-behalf-of exchange subject. The inbound authenticator already verified the token,
// so it is re-parsed unverified here.
//
// The implementation is inspired from:
// pkg/extensions/apiserver/middleware/accessTokenClientMiddleware.go
func onBehalfOfSubjectToken(info types.AuthInfo) string {
	token := info.GetAccessToken()
	if token == "" {
		return ""
	}
	parsed, err := jwt.ParseSigned(token, []jose.SignatureAlgorithm{jose.ES256})
	if err != nil {
		return ""
	}
	var claims authnlib.AccessTokenClaims
	if err := parsed.UnsafeClaimsWithoutVerification(&claims); err != nil || !claims.IsOnBehalfOfUser() {
		return ""
	}
	return token
}

// serviceSubjectToken returns the caller's access token when the caller is a service
// calling on its own behalf.
func serviceSubjectToken(info types.AuthInfo) string {
	if !types.IsIdentityType(info.GetIdentityType(), types.TypeAccessPolicy) {
		return ""
	}
	return info.GetAccessToken()
}

// onBehalfOfFlag reads the OBO policy from OpenFeature per request, mirroring
// requireCallerIdentityFlag: the provider is only reachable after the client is built,
// and targeting is per namespace.
func onBehalfOfFlag(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx,
		FlagUnifiedStorageClientOnBehalfOf, false,
		openfeature.TransactionContext(ctx))
}
