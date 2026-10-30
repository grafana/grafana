package authorizer

import (
	"context"
	"slices"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/open-feature/go-sdk/openfeature"
	k8suser "k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/authorization/union"
)

// WithWatchRestriction denies non-service watches before the delegate can allow them.
// Service callers still require authorization from the delegate.
func WithWatchRestriction(delegate authorizer.Authorizer) authorizer.Authorizer {
	chain, err := union.New(
		union.NamedAuthorizer{AuthorizerName: "watch-restriction", Authorizer: NewWatchRestrictionAuthorizer()},
		union.NamedAuthorizer{AuthorizerName: "delegate", Authorizer: delegate},
	)
	if err != nil {
		panic(err)
	}
	return chain
}

// NewWatchRestrictionAuthorizer only denies non-service watches; other requests
// require authorization downstream, including when the flag is disabled.
func NewWatchRestrictionAuthorizer() authorizer.Authorizer {
	client := openfeature.NewDefaultClient()
	return authorizer.AuthorizerFunc(func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		if !attr.IsResourceRequest() || attr.GetVerb() != "watch" {
			return authorizer.DecisionNoOpinion, "", nil
		}
		if !client.Boolean(ctx, featuremgmt.FlagGrafanaRestrictWatchToServiceIdentities, false, openfeature.TransactionContext(ctx)) {
			return authorizer.DecisionNoOpinion, "", nil
		}
		// In-process informers use Kubernetes loopback credentials, not Grafana service accounts.
		if user := attr.GetUser(); user != nil && slices.Contains(user.GetGroups(), k8suser.SystemPrivilegedGroup) {
			return authorizer.DecisionNoOpinion, "", nil
		}
		if ident, ok := types.AuthInfoFrom(ctx); ok && types.IsIdentityType(ident.GetIdentityType(), types.TypeServiceAccount, types.TypeAccessPolicy) {
			return authorizer.DecisionNoOpinion, "", nil
		}
		return authorizer.DecisionDeny, "watch is restricted to service identities", nil
	})
}
