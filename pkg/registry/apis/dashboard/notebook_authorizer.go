package dashboard

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// newNotebookAuthorizer gates the notebooks resource on FlagDashboardNotebooks,
// evaluated per request via OpenFeature. Notebook storage is always registered,
// so this is where enablement is enforced: when the feature is disabled for the
// request's tenant the request is denied (403) before it reaches admission or
// storage. When enabled, authorization defers to the fallback authorizer (the
// same ServiceAuthorizer other dashboard resources use).
func newNotebookAuthorizer(fallback authorizer.Authorizer) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if attr.IsResourceRequest() &&
				!openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagDashboardNotebooks, false, openfeature.TransactionContext(ctx)) {
				return authorizer.DecisionDeny, "notebooks feature is not enabled", nil
			}
			return fallback.Authorize(ctx, attr)
		})
}
