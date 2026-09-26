package resource

import (
	"context"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/open-feature/go-sdk/openfeature"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var _ authnlib.TokenExchanger = (*onBehalfOfExchanger)(nil)

// onBehalfOfExchanger decorates a TokenExchanger so that calls whose verified access
// token already carries the caller (a user actor) are exchanged on behalf of that
// caller: the caller's token becomes the exchange subject and the exchange is scoped
// to the caller's namespace. Every other call, meaning service identities, classic callers
// whose ID token the interceptor forwards, passes through to the delegate untouched.
type onBehalfOfExchanger struct {
	delegate authnlib.TokenExchanger
	enabled  func(context.Context) bool
}

func (e *onBehalfOfExchanger) Exchange(ctx context.Context, req authnlib.TokenExchangeRequest) (*authnlib.TokenExchangeResponse, error) {
	info, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return e.delegate.Exchange(ctx, req)
	}

	subject := onBehalfOfSubjectToken(info)
	if subject == "" || !e.enabled(ctx) {
		return e.delegate.Exchange(ctx, req)
	}

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

// onBehalfOfFlag reads the OBO policy from OpenFeature per request, mirroring
// requireCallerIdentityFlag: the provider is only reachable after the client is built,
// and targeting is per namespace.
func onBehalfOfFlag(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx,
		featuremgmt.FlagUnifiedStorageClientOnBehalfOf, false,
		openfeature.TransactionContext(ctx))
}
