package dashboard

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/notebooks"
)

func newNotebookAuthorizer(accessControl ac.AccessControl, fallback authorizer.Authorizer) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			if !openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagDashboardNotebooks, false, openfeature.TransactionContext(ctx)) {
				return authorizer.DecisionDeny, "notebooks feature is not enabled", nil
			}

			if accessControl == nil {
				if fallback != nil {
					return fallback.Authorize(ctx, attr)
				}
				return authorizer.DecisionDeny, "access control is not configured", nil
			}

			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			var action string
			switch attr.GetVerb() {
			case "get", "list", "watch":
				action = notebooks.ActionNotebooksRead
			case "create":
				action = notebooks.ActionNotebooksCreate
			case "update", "patch":
				action = notebooks.ActionNotebooksWrite
			case "delete", "deletecollection":
				action = notebooks.ActionNotebooksDelete
			default:
				return authorizer.DecisionDeny, "unsupported verb", nil
			}

			ok, err := accessControl.Evaluate(ctx, user, ac.EvalPermission(action))
			if err != nil {
				return authorizer.DecisionDeny, "access denied", err
			}
			if !ok {
				return authorizer.DecisionDeny, "access denied", nil
			}
			return authorizer.DecisionAllow, "", nil
		})
}
