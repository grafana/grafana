package snapshot

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

// NewSnapshotAuthorizer returns an authorizer that maps k8s verbs to snapshot RBAC actions.
// Anonymous GET requests for snapshots and the dashboard subresource are allowed without
// RBAC checks (mirroring legacy SnapshotPublicMode behavior).
func NewSnapshotAuthorizer(accessControl ac.AccessControl) authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			if !attr.IsResourceRequest() {
				return authorizer.DecisionNoOpinion, "", nil
			}

			// Allow anonymous GET on snapshots and the dashboard subresource (public viewing).
			verb := attr.GetVerb()
			sub := attr.GetSubresource()
			if verb == "get" && (sub == "" || sub == "dashboard") {
				return authorizer.DecisionAllow, "", nil
			}

			user, err := identity.GetRequester(ctx)
			if err != nil {
				return authorizer.DecisionDeny, "valid user is required", err
			}

			// Custom routes: snapshots/create, snapshots/delete/{deleteKey}, snapshots/settings
			// K8s parses these as name="create"|"delete"|"settings" with the path param as subresource.
			name := attr.GetName()
			if name == "create" || name == "delete" || name == "settings" {
				var action string
				switch name {
				case "create":
					action = dashboards.ActionSnapshotsCreate
				case "delete":
					action = dashboards.ActionSnapshotsDelete
				case "settings":
					action = dashboards.ActionSnapshotsRead
				}
				ok, err := accessControl.Evaluate(ctx, user, ac.EvalPermission(action))
				if !ok || err != nil {
					return authorizer.DecisionDeny, "access denied", err
				}
				return authorizer.DecisionAllow, "", nil
			}

			// Handle subresources
			if attr.GetSubresource() != "" {
				var action string
				switch attr.GetSubresource() {
				case "dashboard":
					action = dashboards.ActionSnapshotsRead
				case "deletekey":
					action = dashboards.ActionSnapshotsDelete
				case "delete":
					action = dashboards.ActionSnapshotsDelete
				case "create":
					action = dashboards.ActionSnapshotsCreate
				case "settings":
					action = dashboards.ActionSnapshotsRead
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
