package dashboard

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// newVariableAuthorizer gates the variables resource on FlagGrafanaDashboardGlobalVariables,
// evaluated per request via OpenFeature. Variable storage is always registered,
// so this is where enablement is enforced: when the feature is disabled for the
// request's tenant the request is denied (403) before it reaches admission or
// storage. When enabled, authorization defers to the fallback authorizer (the
// same ServiceAuthorizer other dashboard resources use).
func newVariableAuthorizer(fallback authorizer.Authorizer) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if attr.IsResourceRequest() &&
				!openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagGrafanaDashboardGlobalVariables, false, openfeature.TransactionContext(ctx)) {
				return authorizer.DecisionDeny, "global dashboard variables feature is not enabled", nil
			}
			return fallback.Authorize(ctx, attr)
		})
}
