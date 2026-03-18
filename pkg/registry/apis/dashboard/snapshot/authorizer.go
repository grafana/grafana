package snapshot

import (
	"context"
	"strings"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

// NewSnapshotAuthorizer returns an authorizer that maps k8s verbs to snapshot RBAC actions.
// When public mode is enabled, anonymous users are allowed to access public-create and public-delete subresources.
func NewSnapshotAuthorizer(accessControl ac.AccessControl, options dashv0.SnapshotSharingOptions) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			// In public mode, allow anonymous access to public-create and public-delete subresources
			if options.SnapshotPublicMode {
				sub := attr.GetSubresource()
				if sub == "public-create" || strings.HasPrefix(sub, "public-delete") {
					return authorizer.DecisionAllow, "", nil
				}
			}

			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			// Handle subresources
			if attr.GetSubresource() != "" {
				var action string
				switch attr.GetSubresource() {
				case "dashboard":
					action = dashboards.ActionSnapshotsRead
				case "deletekey":
					action = dashboards.ActionSnapshotsDelete
				default:
					return authorizer.DecisionDeny, "unsupported subresource", nil
				}
				ok, err := accessControl.Evaluate(ctx, user, ac.EvalPermission(action))
				if !ok || err != nil {
					return authorizer.DecisionDeny, "access denied", err
				}
				return authorizer.DecisionAllow, "", nil
			}

			// Map k8s verbs to snapshot RBAC actions
			var action string
			switch attr.GetVerb() {
			case "get", "list":
				action = dashboards.ActionSnapshotsRead
			case "create":
				action = dashboards.ActionSnapshotsCreate
			case "delete":
				action = dashboards.ActionSnapshotsDelete
			default:
				return authorizer.DecisionDeny, "unsupported verb", nil
			}

			ok, err := accessControl.Evaluate(ctx, user, ac.EvalPermission(action))
			if !ok || err != nil {
				return authorizer.DecisionDeny, "access denied", err
			}
			return authorizer.DecisionAllow, "", nil
		})
}
